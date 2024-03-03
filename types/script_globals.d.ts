declare global {
	var $: {
		"serverUi": typeof import("@minecraft/server-ui")
		"server": typeof import("@minecraft/server")
	}
}
export {};