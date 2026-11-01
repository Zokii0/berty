import * as Notifications from 'expo-notifications'
import { useCallback, useEffect } from 'react'
import { Alert, AppState, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { GoBridge } from 'berty-bridge-expo'

import beapi from '@berty/api'
import { selectNodeNetworkConfig } from '@berty/redux/reducers/networkConfig.reducer'

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

// Android: returns a function that offers to turn Bluetooth on (system dialog) when it is
// useful, i.e. when Bluetooth is enabled in Berty's network settings, is turned off on the
// phone and there is no Wi-Fi/mobile/ethernet network (so Bluetooth is the only way to reach
// the contact). Meant to be called when the user adds a contact (QR) or sends a message.
// It asks at most once every couple of minutes.
export const useBluetoothEnablePrompt = () => {
	const { t } = useTranslation()
	const nodeNetworkConfig = useAppSelector(selectNodeNetworkConfig)
	const bluetoothWanted =
		nodeNetworkConfig?.bluetoothLe === beapi.account.NetworkConfig.Flag.Enabled

	return useCallback(async () => {
		if (
			Platform.OS !== 'android' ||
			!bluetoothWanted ||
			Date.now() - lastBluetoothPrompt < BLUETOOTH_PROMPT_INTERVAL_MS
		) {
			return
		}
		try {
			if ((await GoBridge.isBluetoothEnabled()) || (await GoBridge.hasNetworkConnection())) {
				return
			}
			lastBluetoothPrompt = Date.now()
			Alert.alert(t('notification.bluetooth-off.title'), t('notification.bluetooth-off.desc'), [
				{ text: t('notification.bluetooth-off.not-now'), style: 'cancel' },
				{
					text: t('notification.bluetooth-off.confirm'),
					onPress: () => {
						GoBridge.requestEnableBluetooth().catch(err =>
							console.warn('unable to request to enable bluetooth: ', err),
						)
					},
				},
			])
		} catch (err) {
			console.warn('bluetooth state check failed: ', err)
		}
	}, [bluetoothWanted, t])
}
