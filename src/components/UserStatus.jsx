import React, { useEffect, useState } from "react";

const UserStatus = ({ status = "", absolute = false }) => {
	const [color, setColor] = useState("");

	useEffect(() => {
		switch (status) {
			case "online":
				setColor("rgb(14, 201, 70)");
				break;
			case "idle":
				setColor("rgb(255, 209, 27)");
				break;
			case "do not disturb":
				setColor("rgb(236, 0, 0)");
				break;

			default:
				setColor("gray");
				break;
		}
	}, [status]);

	return (
		<div
			className={`user-status circle ${absolute ? "absolute" : ""}`}
			style={{
				backgroundColor: color
			}}
		/>
	);
};

export default React.memo(UserStatus);
