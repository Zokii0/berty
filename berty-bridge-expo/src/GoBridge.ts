import BertyBridgeExpoModule from "./BertyBridgeExpoModule";

export enum GoLogLevel {
	debug = "debug",
	info = "info",
	error = "error",
	warn = "warn",
}

type GoLoggerOpts = {
	level: GoLogLevel;
	message: string;
};

export interface GoBridgeInterface {
	log(opts: GoLoggerOpts): void;
	initBridge(): Promise<void>;
	initBridgeRemote(address: string): Promise<void>;
	clearStorage(): Promise<void>;
	closeBridge(): Promise<void>;
	invokeBridgeMethod(method: string, b64message: string): Promise<string>;
	connectService(serviceName: string, address: string): Promise<void>;
	requestPushToken(): Promise<string>;
	startBackgroundService(title: string, text: string): Promise<void>;
	stopBackgroundService(): Promise<void>;
	quitApp(): Promise<void>;
}

class GoBridge implements GoBridgeInterface {
	log(opts: GoLoggerOpts): void {
		return BertyBridgeExpoModule.log(opts);
	}

	initBridge(): Promise<void> {
		return BertyBridgeExpoModule.initBridge();
	}

	initBridgeRemote(address: string): Promise<void> {
		return BertyBridgeExpoModule.initBridgeRemote(address);
	}

	clearStorage(): Promise<void> {
		return BertyBridgeExpoModule.clearStorage();
	}

	closeBridge(): Promise<void> {
		return BertyBridgeExpoModule.closeBridge();
	}

	invokeBridgeMethod(method: string, b64message: string): Promise<string> {
		return BertyBridgeExpoModule.invokeBridgeMethod(method, b64message);
	}

	connectService(serviceName: string, address: string): Promise<void> {
		return BertyBridgeExpoModule.connectService(serviceName, address);
	}

	requestPushToken(): Promise<string> {
		return BertyBridgeExpoModule.requestPushToken();
	}

	startBackgroundService(title: string, text: string): Promise<void> {
		return BertyBridgeExpoModule.startBackgroundService(title, text);
	}

	stopBackgroundService(): Promise<void> {
		return BertyBridgeExpoModule.stopBackgroundService();
	}

	quitApp(): Promise<void> {
		return BertyBridgeExpoModule.quitApp();
	}
}

const goBridge: GoBridgeInterface = new GoBridge();
export { goBridge as GoBridge };
