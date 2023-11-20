import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useStateProvider } from "../context";
import { FriendsIcon, CloseIcon } from "../assets/icons";
import { Avatar, HDivider, UserStatus } from "./";

const Sidebar = ({ smallDevice, height, call, setBurgerMenu }) => {
	const { rooms, setRooms, selectedRoom, messages } = useStateProvider()

	const activeLink = () => {
		smallDevice ? setBurgerMenu(false) : "";
	};

	useEffect(() => {
		const lastMessage = messages?.at(-1)
		const foundRoom = rooms?.find(room => room?.participants[1]?.id === lastMessage?.roomID)
		if (foundRoom) {
			const filteredList = rooms?.filter(room => room?.id !== foundRoom?.id)
			const reorderedList = [foundRoom, ...filteredList].map((room, idx) => {
				return {
					id: room.id,
					index: idx,
					type: room.type,
					participants: room.participants
				}
			})
			setRooms(reorderedList)
		}
	}, [messages])

	return (
		<div className="sidebar">
			<div className="sidebar-top">
				<Link
					to="/"
					className="link friends-link"
					onClick={() => activeLink()}
				>
					<FriendsIcon />
					Friends
				</Link>
				{smallDevice ? (
					<div onClick={() => setBurgerMenu(false)}>
						<CloseIcon />
					</div>
				) : (
					""
				)}
			</div>
			<HDivider />
			<div
				className="sidebar-list"
				style={{
					minHeight: call.inCall ? "412px" : "112px",
					height
				}}
			>
				{rooms.map(({ participants }, idx) => {
					const { id, username, avatar, status } = participants[1]
					return (
						<Link
							key={idx}
							className={`link user-links ${selectedRoom?.participants[1].id === id ? "active" : ""}`}
							to={`/@me/${id}`}
							onClick={() => activeLink()}
						>
							<div style={{ position: "relative", display: "flex" }}>
								<Avatar
									size={35}
									bgColor={avatar}
								/>
								<UserStatus
									status={status}
									absolute={true}
								/>
							</div>
							<p>{username}</p>
						</Link>
					);
				})}
			</div>
		</div>
	);
};

export default Sidebar;
