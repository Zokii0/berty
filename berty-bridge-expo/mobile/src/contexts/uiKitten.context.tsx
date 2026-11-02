import { mapping, light, dark } from "@eva-design/eva";
import { ApplicationProvider } from "@ui-kitten/components";
import { StatusBar } from "expo-status-bar";
import React from "react";

import { useIsDarkTheme } from "@berty/hooks";

interface UIKittenProviderProps {
	children: React.ReactNode;
}

export const UIKittenProvider = ({ children }: UIKittenProviderProps) => {
	const isDark = useIsDarkTheme();

	return (
		<>
			<ApplicationProvider
				mapping={mapping}
				customMapping={
					{
						strict: {
							"text-font-family": "Open Sans",
							"text-paragraph-1-font-weight": "600",
						},
					} as any
				}
				theme={isDark ? dark : light}
			>
				<StatusBar style={isDark ? "light" : "dark"} />
				{children}
			</ApplicationProvider>
		</>
	);
};
