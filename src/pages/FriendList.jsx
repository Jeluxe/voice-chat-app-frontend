import { useEffect, useState } from "react";
import { Friend, NewFriendForm } from "../components";
import { useStateProvider } from "../context";

const userStatus = ['online', 'offline', 'idle'];
const requestStatus = ["PENDING", "ACCEPTED", "BLOCKED"];

const FriendList = () => {
	const { friendList, selectedFilter, smallDevice } = useStateProvider();
	const [friendListObject, setFriendListObject] = useState({});

	useEffect(() => setFriendListObject(filterArray(friendList)), [friendList]);

	const filterClientsByStatus = (request) => {
		const validation = request.status !== "PENDING" && request.status !== "BLOCKED"

		switch (selectedFilter) {
			case "All":
				return userStatus.includes(request.user.status) && validation
			case "Online":
				return userStatus.includes(request.user.status) && request.user.status === "online" && validation
			case "Blocked":
				return requestStatus.includes(request.status) && request.status === "BLOCKED"
			case "Pending":
				return requestStatus.includes(request.status) && request.status === "PENDING"
			default:
				break;
		}
	}

	const filterArray = (friends) => {
		return friends.reduce((filteredObject, friend) => {
			const status = friend.user?.status || "offline";
			if (!filteredObject[status]) {
				filteredObject[status] = [];
			}
			if (friend.status !== "PENDING" && friend.status !== "BLOCKED") {
				filteredObject[status].push(friend);
			}
			return filteredObject;
		}, {});
	};
	return (
		<div className="friends-container">
			{
				!selectedFilter ? (
					<NewFriendForm />
				) : smallDevice ? (
					<div className="friend-list">
						{Object.entries(friendListObject).map(([key, list], idx) => {
							return <div key={idx}>
								<b>{key}</b>
								<div>
									{list.map((candidate, idx) => (
										<Friend key={idx} data={candidate} />
									))}
								</div>
							</div>
						})}
					</div>
				) : (
					<div className="friend-list">
						{
							friendList.filter(filterClientsByStatus).map((friend, idx) => (
								<Friend key={idx} data={friend} />
							))}
					</div>
				)}
		</div>

	);
};

export default FriendList;
