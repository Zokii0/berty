import * as Notifications from 'expo-notifications'
import { useCallback, useEffect } from 'react'
import { AppState, PermissionsAndroid, Platform } from 'react-native'
import { GoBridge, GoLogLevel } from 'berty-bridge-expo'

import beapi from '@berty/api'
import { selectNodeNetworkConfig } from '@berty/redux/reducers/networkConfig.reducer'
import { selectSelectedAccount } from '@berty/redux/reducers/ui.reducer'
import { accountClient } from '@berty/utils/accounts/accountClient'

import { useAppDispatch } from '@berty/hooks'
import { useNavigation } from '@berty/navigation'
import {
	addNotificationInhibitor,
	removeNotificationInhibitor,
} from '@berty/redux/reducers/ui.reducer'
import { NotificationsInhibitor } from '@berty/utils/notification/notif-in-app'
import { Maybe } from '@berty/utils/type/maybe'

import { useAppSelector } from './core.hooks'
import { useMountEffect } from './react.hooks'

export const useNotificationsInhibitor = (inhibitor: Maybe<NotificationsInhibitor>) => {
	const dispatch = useAppDispatch()
	const navigation = useNavigation()
	useMountEffect(() => {
		if (!inhibitor) {
			return
		}

		const inhibit = () => dispatch(addNotificationInhibitor({ inhibitor }))
		const revert = () => dispatch(removeNotificationInhibitor({ inhibitor }))

		const unsubscribeBlur = navigation.addListener('blur', revert)
		const unsubscribeFocus = navigation.addListener('focus', inhibit)

		inhibit()

		return () => {
			unsubscribeFocus()
			unsubscribeBlur()
			revert()
		}
	})
}

// Dismisses the conversation's tray notifications while its screen is focused.
export const useDismissNotificationsEffect = (convPK: Maybe<string>) => {
	const navigation = useNavigation()

	useEffect(() => {
		if (!convPK) {
			return
		}

		const dismiss = async () => {
			try {
				const presented = await Notifications.getPresentedNotificationsAsync()
				await Promise.all(
					presented
						.filter(
							n =>
								(n.request.content.data as { convPK?: string } | undefined)?.convPK === convPK,
						)
						.map(n => Notifications.dismissNotificationAsync(n.request.identifier)),
				)
			} catch (e) {
				console.warn('failed to dismiss conversation notifications', e)
			}
		}

		dismiss()
		const unsubscribeFocus = navigation.addListener('focus', dismiss)
		// Coming back to the app from the recent apps (or from another app) does not focus the
		// screen again, so also clear the notifications when the app becomes active on this chat.
		const appStateSubscription = AppState.addEventListener('change', state => {
			if (state === 'active' && navigation.isFocused()) {
				dismiss()
			}
		})
		return () => {
			unsubscribeFocus()
			appStateSubscription.remove()
		}
	}, [convPK, navigation])
}

const BLUETOOTH_PROMPT_INTERVAL_MS = 2 * 60 * 1000
let lastBluetoothPrompt = 0
let bluetoothPromptRunning = false

// written in the logs of the app (Developer tools -> Export logs), to know why the prompt is
// (not) shown
const logBluetoothPrompt = (message: string) => {
	try {
		GoBridge.log({ level: GoLogLevel.warn, message: `bluetooth prompt: ${message}` })
	} catch (err) {
		console.warn('bluetooth prompt log failed: ', err)
	}
}

// Android: returns a function that offers to turn Bluetooth on (system dialog) when it is
// useful, i.e. when Bluetooth is enabled in Berty's network settings, is turned off on the
// phone and there is no Wi-Fi/mobile/ethernet network (so Bluetooth is the only way to reach
// the contact). Meant to be called when the user adds a contact (QR) or sends a message.
// It asks at most once every couple of minutes.
export const useBluetoothEnablePrompt = () => {
	const nodeNetworkConfig = useAppSelector(selectNodeNetworkConfig)
	const selectedAccount = useAppSelector(selectSelectedAccount)

	return useCallback(async () => {
		if (Platform.OS !== 'android' || bluetoothPromptRunning) {
			return
		}
		if (Date.now() - lastBluetoothPrompt < BLUETOOTH_PROMPT_INTERVAL_MS) {
			logBluetoothPrompt('skipped, already asked less than 2 minutes ago')
			return
		}
		bluetoothPromptRunning = true
		try {
			// The network config in the store is only filled when the settings screen was opened
			// (it is empty after the start of the app), so read the one of the account if needed.
			let bluetoothLe = nodeNetworkConfig?.bluetoothLe
			if (!bluetoothLe) {
				const conf = await accountClient.networkConfigGet({ accountId: selectedAccount })
				bluetoothLe = conf.currentConfig?.bluetoothLe
			}
			if (bluetoothLe !== beapi.account.NetworkConfig.Flag.Enabled) {
				logBluetoothPrompt(`skipped, Bluetooth is not enabled in the network config (${bluetoothLe})`)
				return
			}

			const bluetoothOn = await GoBridge.isBluetoothEnabled()
			const hasNetwork = await GoBridge.hasNetworkConnection()
			if (bluetoothOn || hasNetwork) {
				logBluetoothPrompt(
					`skipped, bluetoothEnabled=${bluetoothOn} hasNetworkConnection=${hasNetwork}`,
				)
				return
			}

			// Android 12+: without this permission the system dialog is closed right away
			if (typeof Platform.Version === 'number' && Platform.Version >= 31) {
				const connectPermission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
				if (connectPermission && !(await PermissionsAndroid.check(connectPermission))) {
					lastBluetoothPrompt = Date.now()
					const result = await PermissionsAndroid.request(connectPermission)
					logBluetoothPrompt(`BLUETOOTH_CONNECT was not granted, request result: ${result}`)
					if (result !== PermissionsAndroid.RESULTS.GRANTED) {
						return
					}
				}
			}

			// the system dialog ("Allow Berty to turn on Bluetooth?") explains itself
			const requested = await GoBridge.requestEnableBluetooth()
			logBluetoothPrompt(`system dialog requested: ${requested}`)
			if (requested) {
				lastBluetoothPrompt = Date.now()
			}
		} catch (err) {
			console.warn('bluetooth state check failed: ', err)
			logBluetoothPrompt(`failed: ${String((err as any)?.message ?? err)}`)
		} finally {
			bluetoothPromptRunning = false
		}
	}, [nodeNetworkConfig, selectedAccount])
}
