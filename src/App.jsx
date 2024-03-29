import {
	createBrowserRouter,
	createRoutesFromElements,
	Route,
	RouterProvider,
} from "react-router-dom";
import { Layout } from "./components";
import { ContextProvider, SocketIOProvider } from "./context";
import { Home, Login, Room, Settings, Signup } from "./pages";

const router = createBrowserRouter(
	createRoutesFromElements(
		<>
			<Route
				exact
				path="/home"
				element={<Home />}
			/>
			<Route
				exact
				path="/"
				element={<Layout />}
			>
				<Route
					path="/@me/:id"
					element={<Room />}
				/>
			</Route>
			<Route
				path="/login"
				element={<Login />}
			/>
			<Route
				path="/signup"
				element={<Signup />}
			/>
			<Route
				path="*"
				element={<div>page not found 404</div>}
			/>
		</>
	)
);

const App = () => {

	return (
		<ContextProvider>
			<SocketIOProvider>
				<RouterProvider router={router} />
			</SocketIOProvider>
		</ContextProvider>
	)

};

export default App;
