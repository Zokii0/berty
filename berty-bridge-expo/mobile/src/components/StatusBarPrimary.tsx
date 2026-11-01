import React from 'react'
import { StatusBar } from 'react-native'

import { useIsDarkTheme, useThemeColor } from '@berty/hooks'

export const StatusBarPrimary: React.FC = () => {
	const colors = useThemeColor()
	const isDark = useIsDarkTheme()
	return (
		<StatusBar
			backgroundColor={colors['main-background']}
			barStyle={isDark ? 'light-content' : 'dark-content'}
		/>
	)
}
