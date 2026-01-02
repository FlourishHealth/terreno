import {fernsApi, getCurrentExpoToken, logout, resetAppState} from "@store";
import {IsWeb, UserTypes} from "@utils";
import type {ExpoPushToken} from "expo-notifications";
import {useToast} from "ferns-ui";
import {useDispatch} from "react-redux";

import {useReadProfile} from "./useReadProfile";

// NOTE: These mutations are expected to be generated from the OpenAPI spec
// If they don't exist, the API may need to have these endpoints defined
// Placeholder mutation hook - returns tuple with mutation function and result
type MutationResult = {unwrap: () => Promise<Record<string, unknown>>};
type MutationFunction = (args: Record<string, unknown>) => MutationResult;

const useOfflineToggleMutation = (): [MutationFunction] => {
	// Placeholder - should be replaced with actual generated hook from OpenAPI spec
	return [() => ({unwrap: async () => ({})})];
};

const usePatchUsersByIdMutation = (): [MutationFunction] => {
	// Placeholder - should be replaced with actual generated hook from OpenAPI spec
	return [() => ({unwrap: async () => ({})})];
};

// Placeholder for local form instance store clearing
const clearLocalFormInstanceStore = (): {type: string} => {
	return {type: "CLEAR_LOCAL_FORM_INSTANCE_STORE"};
};

type LogoutUser = () => Promise<void>;

export function useLogoutUser(): LogoutUser {
	const user = useReadProfile();
	const [offlineToggle] = useOfflineToggleMutation();
	const [updateUser] = usePatchUsersByIdMutation();
	const toast = useToast();
	const dispatch = useDispatch();

	return async (): Promise<void> => {
		if (user && !IsWeb) {
			console.debug(`Clearing expoToken for user ${user._id}`);
			// we only want to remove the expo token if they are logging out of the mobile app
			let expoPushToken: ExpoPushToken | undefined;
			try {
				expoPushToken = await getCurrentExpoToken();
			} catch (error) {
				toast.catch(error, `Error getting expoToken for user ${user._id}`);
			}
			// remove this token from the expoTokens array
			if (expoPushToken) {
				try {
					await updateUser({
						body: {
							expoTokens: user.expoTokens?.filter(
								(t: string) => t !== expoPushToken.data.toString()
							),
						},
						id: user._id,
					}).unwrap();
				} catch (error) {
					toast.catch(error, `Error removing expoToken for user ${user._id}`);
				}
			}
		}
		if (user?.online?.forPatients) {
			try {
				await offlineToggle({
					_id: user?._id,
					type: UserTypes.Patient,
				}).unwrap();
			} catch (error) {
				toast.catch(error, `Error setting user ${user._id} offline for patients`);
			}
		}
		if (user?.online?.forFamilyMembers) {
			try {
				await offlineToggle({
					_id: user?._id,
					type: UserTypes.FamilyMember,
				}).unwrap();
			} catch (error) {
				toast.catch(error, `Error setting user ${user._id} offline for family members`);
			}
		}
		// TODO: Resolve resetAppState and logout() happening asynchronously in order to purge RTK
		// simultaneously and remove the need for memoizedUser in App.tsx
		dispatch(logout());
		dispatch(clearLocalFormInstanceStore());
		dispatch(resetAppState());
		dispatch(fernsApi.util.resetApiState());
	};
}
