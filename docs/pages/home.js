Roselt.Page.Title = "Roselt.js";
Roselt.Page.Description = "File-based vanilla JavaScript app framework for full web applications, product sites, and desktop-ready shells.";

Roselt.Page.Load = () => {
	const timeElement = Roselt.Page.querySelector("[data-current-time]");
	const batteryFillElement = Roselt.Page.querySelector("[data-battery-fill]");
	const batteryIcon = Roselt.Page.querySelector("[data-battery-icon]");

	if (!(timeElement instanceof HTMLElement)) {
		return null;
	}

	const currentTime = new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date());

	timeElement.textContent = currentTime;

	if (batteryFillElement instanceof SVGRectElement) {
		const maxBatteryFillWidth = 14;

		const applyBatteryLevel = (level) => {
			const normalizedLevel = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
			const fillWidth = normalizedLevel * maxBatteryFillWidth;

			batteryFillElement.setAttribute("width", fillWidth.toFixed(1));

			if (batteryIcon instanceof SVGElement) {
				batteryIcon.dataset.batteryLevel = Math.round(normalizedLevel * 100).toString();
			}
		};

		if (typeof navigator.getBattery === "function") {
			navigator.getBattery().then((battery) => {
				applyBatteryLevel(battery.level);
			}).catch(() => {
				applyBatteryLevel(0);
			});
		}
	}

	return null;
};