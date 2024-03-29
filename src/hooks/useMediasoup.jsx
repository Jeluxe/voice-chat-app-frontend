import * as mediasoupClient from "mediasoup-client";
import { useEffect, useRef, useState } from 'react';
import { useSocketIOProvider, useStateProvider } from "../context";

const produceParams = {
  encoding: [
    { rid: "r0", maxBitRate: 100000, scalabilities: "S1T3" },
    { rid: "r1", maxBitRate: 300000, scalabilities: "S1T3" },
    { rid: "r2", maxBitRate: 900000, scalabilities: "S1T3" },
  ],
  codecOptions: {
    videoGoogleStateBitRate: 1000,
  },
};

export const useMediasoup = () => {
  const { user: { id: userID }, inCall, videoContainer, muteToggle, videoToggle } = useStateProvider()
  const { emitData, addSocketEvent, removeSocketEvent } = useSocketIOProvider()
  const roomID = useRef(null)
  const device = useRef(null);
  const rtpCapabilities = useRef(null);
  const producerTransport = useRef(null);
  const consumersIds = useRef({});
  const videoProducer = useRef(null);
  const audioProducer = useRef(null);
  const shareScreenProducer = useRef(null);
  const consumerTransports = useRef([]);
  const tracks = useRef(null);
  const localStreamRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const remoteStreamsRef = useRef([])
  const [remoteStreams, setRemoteStreams] = useState([])

  useEffect(() => {
    // server informs the client of an new producer just joined
    addSocketEvent("new-producer", ({ producerId }) => {
      signalNewConsumerTransport(producerId);
    });

    addSocketEvent("producer-closed", async ({ remoteProducerId }) => {
      if (consumerTransports.current.length) {
        // close the client-side consumer and associated transport
        let consumersToRemove;
        const transportToClose = consumerTransports.current.find(
          (transportData) =>
            transportData.producerIds.includes(remoteProducerId)
        );

        if (!transportToClose) return;

        consumersToRemove = transportToClose?.producerIds;

        if (consumersToRemove) {
          // remove the video div element
          const foundId = consumersToRemove.find((id) =>
            document.getElementById(`td-${id}`)
          );

          if (foundId) {
            videoContainer.current?.removeChild(
              document.getElementById(`td-${foundId}`)
            );
          }
        }
        //close all consumers related to specific user
        transportToClose?.consumers.forEach(
          async (consumer) => await consumer.close()
        );
        transportToClose.consumers
          ? delete transportToClose.consumers
          : "";

        //close transport related to specific user
        if (!transportToClose.consumers) {
          await transportToClose.consumerTransport.close();
        }

        // remove the consumer transport from the list
        consumerTransports.current = consumerTransports.current.filter(
          (transportData) =>
            transportData.producerIds.includes(remoteProducerId)
        );

        remoteStreamsRef.current = remoteStreamsRef.current.filter(stream => {
          return Object.keys(stream)[0] !== transportToClose.serverConsumerTransportId
        })

        setRemoteStreams(remoteStreamsRef.current);
        delete consumersIds.current[userID];
      }
    });

    return () => {
      removeSocketEvent("new-producer");
      removeSocketEvent("producer-closed");
    };
  }, [])

  useEffect(() => {
    if (videoProducer.current) {
      playPause(videoProducer, !videoToggle);
    } else if (!videoProducer.current && localStream && videoToggle) {
      getMedia(true).then(stream => {
        const videoTrack = stream.getVideoTracks()[0];
        tracks.current.video = videoTrack;
        localStream.addTrack(videoTrack)
        connectSendTransport("video")
        emitData("video-toggle", roomID.current)
      });
    }
  }, [videoToggle]);

  useEffect(() => {
    playPause(audioProducer, muteToggle);
  }, [muteToggle]);

  const playPause = (producer, value) => {
    if (producer.current) {
      if (producer.current.kind === "video") {
        emitData("video-toggle", roomID.current, value)
      }
      if (value) {
        producer.current.pause();
      } else {
        producer.current.resume();
      }
    }
  };

  const call = async (selectedRoomID, video) => {
    if (inCall.activeCall && inCall.roomID !== selectedRoomID) {
      await closeConnection()
    }
    roomID.current = selectedRoomID;
    getMedia(video)
      .then(streamSuccess)
      .catch((error) => console.log(error.message));
  };

  const getMedia = (video) => {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video,
    });
  };

  const streamSuccess = (stream) => {
    localStreamRef.current = stream;

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    tracks.current = {
      video: videoTrack ?? null,
      audio: audioTrack,
    };

    joinRoom();
  };

  const joinRoom = () => {
    emitData("joinRoom", roomID.current, (data) => {
      rtpCapabilities.current = data.rtpCapabilities;

      // once we have rtpCapabilities from the Router, create device.
      createDevice();
    });
  };

  const getProducers = () => {
    emitData("getProducers", async (producerIds) => {
      producerIds.map((id, idx) => {
        setTimeout(() => {
          signalNewConsumerTransport(id);
        }, idx * 500);
      });
    });
  };

  const createDevice = async () => {
    try {
      if (!device.current) {
        device.current = new mediasoupClient.Device();
        // loads the device with RTP capabilities pf the router (server side)
        await device.current.load({
          routerRtpCapabilities: rtpCapabilities.current,
        });
      }

      emitData("peersExist", (peersExist) => {
        if (peersExist) getProducers();
      });

      // once deivce loads, create transport.
      createSendTransport();
    } catch (error) {
      if (error.message === "UnsupportedError")
        console.warn("browser not supported");
    }
  };

  const createSendTransport = () => {
    emitData(
      "createWebRtcTransport",
      { consumer: false },
      ({ params }) => {
        if (params.error) {
          console.log(params.error);
          return;
        }

        producerTransport.current =
          device.current.createSendTransport(params);

        producerTransport.current.on(
          "connect",
          async ({ dtlsParameters }, callback, errback) => {
            try {
              // Signal local DTLS parameters to the server transport
              await emitData("transport-connect", {
                dtlsParameters,
              });

              // Tell the transport that parameters were transmitted.
              callback();
            } catch (error) {
              errback(error);
            }
          }
        );

        producerTransport.current.on(
          "produce",
          async (parameters, callback, errback) => {
            try {
              emitData(
                "transport-produce",
                {
                  transportId: producerTransport.current.id,
                  kind: parameters.kind,
                  rtpParameters: parameters.rtpParameters,
                  appData: parameters.appData,
                },
                ({ id, kind }) => {
                  callback({ id });
                  emitData("inform-consumers", id, kind);
                }
              );
            } catch (error) {
              errback(error);
            }
          }
        );

        producerTransport.current.on("connectionstatechange", (state) => {
          switch (state) {
            case "connecting":
              console.log("publishing...");
              break;
            case "connected":
              setLocalStream(localStreamRef.current);
              console.log("connected");
              break;
            case "failed":
              console.log("failed");
              break;

            default:
              break;
          }
        });

        connectSendTransport(tracks.current.video ? "video" : "", "audio");
      }
    );
  };

  const connectSendTransport = async (...args) => {
    let producer;

    if (args.includes("video")) {
      producer = await producerTransport.current.produce({
        track: tracks.current.video,
        ...produceParams,
      });
      videoProducer.current = producer;
    }

    if (args.includes("audio")) {
      producer = await producerTransport.current.produce({
        track: tracks.current.audio,
        ...produceParams,
      });
      muteToggle ? producer.pause() : "";
      audioProducer.current = producer;
    }

    if (args.includes("share")) {
      producer = await producerTransport.current.produce({
        track: tracks.current.share,
        ...produceParams,
      });
      shareScreenProducer.current = producer;
    }

    producer.on("trackended", () => {
      console.log("track ended");
    });

    producer.on("transportclose", () => {
      console.log("transport ended");
    });
  };

  const signalNewConsumerTransport = async (remoteProducerId) => {
    emitData(
      "createWebRtcTransport",
      { consumer: true },
      async ({ params }) => {
        let consumerTransport;
        if (params.error && params.error === "transportExists") {
          consumerTransport = findConsumerTransport(
            params.transportId
          )?.consumerTransport;
        } else {
          consumerTransport = await device.current.createRecvTransport(
            params
          );
        }

        consumerTransport.on(
          "connect",
          async ({ dtlsParameters }, callback, errback) => {
            try {
              await emitData("transport-recv-connect", {
                dtlsParameters,
                serverConsumerTransportId: params.id,
              });

              callback();
            } catch (error) {
              errback(error);
            }
          }
        );

        consumerTransport.on("connectionstatechange", (state) => {
          switch (state) {
            case "connecting":
              console.log("consuming...");
              break;
            case "connected":
              console.log("consumed!");
              break;
            case "failed":
              console.log("failed");
              break;
            default:
              break;
          }
        });

        connectRecvTransport(
          consumerTransport,
          remoteProducerId,
          params.id ? params.id : consumerTransport.id
        );
      }
    );
  };

  const connectRecvTransport = async (
    consumerTransport,
    remoteProducerId,
    serverConsumerTransportId
  ) => {
    emitData(
      "consume",
      {
        rtpCapabilities: device.current.rtpCapabilities,
        remoteProducerId,
        serverConsumerTransportId,
      },
      async ({ params }) => {
        if (params.error) {
          console.warn("Cannot Consume");
          return;
        }

        const consumer = await consumerTransport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });

        updateConsumerTransportList(
          serverConsumerTransportId,
          consumerTransport,
          remoteProducerId,
          consumer
        );

        addConsumerId(consumer.kind, remoteProducerId);
        addRemoteStream(serverConsumerTransportId, consumer.track)

        emitData("consumer-resume", {
          serverConsumerId: params.serverConsumerId,
        });
      }
    );
  };

  const addRemoteStream = async (transportId, track) => {
    const foundStream = remoteStreamsRef.current.find(stream => Object.keys(stream)[0] === transportId);

    if (foundStream) {
      await foundStream[transportId].addTrack(track);
    } else {
      const newStream = new MediaStream([track])
      remoteStreamsRef.current = [...remoteStreamsRef.current, {
        [transportId]: newStream
      }];
      setRemoteStreams(remoteStreamsRef.current)
    }
  }

  const findConsumerTransport = (id) => {
    return consumerTransports.current.find(
      (transport) => transport.serverConsumerTransportId === id
    );
  };

  const updateConsumerTransportList = (
    serverConsumerTransportId,
    consumerTransport,
    remoteProducerId,
    consumer
  ) => {
    const target = findConsumerTransport(serverConsumerTransportId);

    if (!target) {
      consumerTransports.current = [
        ...consumerTransports.current,
        {
          consumerTransport,
          serverConsumerTransportId,
          producerIds: [remoteProducerId],
          consumers: [consumer],
        },
      ];
    } else {
      target["producerIds"] = [...target["producerIds"], remoteProducerId];
      target["consumers"] = [...target["consumers"], consumer];
    }
  };

  const addConsumerId = (type, remoteProducerId) => {
    consumersIds.current[userID] = {
      ...consumersIds.current[userID],
      [type]: remoteProducerId
    };
  };

  const closeConnection = async () => {
    await videoProducer.current?.close();
    await audioProducer.current?.close();
    await producerTransport.current?.close();

    consumerTransports.current.forEach((transportData) =>
      transportData?.transport?.close()
    );

    device.current = null;
    await localStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    remoteStreamsRef.current = [];
    setRemoteStreams(remoteStreamsRef.current);
    localStreamRef.current = null;
    setLocalStream(null)
    consumerTransports.current = [];
    producerTransport.current = null;
    videoProducer.current = null;
    audioProducer.current = null;
    rtpCapabilities.current = null;
    tracks.current = null;
    consumersIds.current = {};
    roomID.current = null;
    emitData("leaveRoom");
  };

  return { call, localStream, remoteStreams, closeConnection }
}