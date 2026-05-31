const THEME_LABELS = {
	dark: "Dark",
	light: "Light",
	blue: "Blue",
};

Roselt.Page.Title = "Settings";
Roselt.Page.Description = "Workspace appearance settings";
Roselt.Page.Load = function () {
	const themeApi = window.AdminDemoTheme;

	if (!themeApi) {
		return;
	}

	const label = Roselt.Page.querySelector("[data-current-theme-label]");
	const options = Array.from(Roselt.Page.querySelectorAll("[data-theme-option]"));
	const buttons = Array.from(Roselt.Page.querySelectorAll("[data-theme-button]"));

	const render = function () {
		const activeTheme = themeApi.get();

		if (label) {
			label.textContent = THEME_LABELS[activeTheme] || activeTheme;
		}

		for (const option of options) {
			option.classList.toggle("is-active", option.getAttribute("data-theme-option") === activeTheme);
		}

		for (const button of buttons) {
			const buttonTheme = button.getAttribute("data-theme-button");
			const isActive = buttonTheme === activeTheme;

			button.setAttribute("variant", isActive ? "primary" : "secondary");
			button.textContent = isActive ? "Active theme" : "Apply theme";
		}
	};

	const handleThemeChange = function () {
		render();
	};

	const handleButtonClick = function (event) {
		const button = event.currentTarget;
		const nextTheme = button.getAttribute("data-theme-button");

		if (!nextTheme) {
			return;
		}

		themeApi.set(nextTheme);
	};

	for (const button of buttons) {
		button.addEventListener("click", handleButtonClick);
	}

	document.addEventListener("admin-demo:theme-change", handleThemeChange);
	Roselt.Page.cleanup(function () {
		document.removeEventListener("admin-demo:theme-change", handleThemeChange);

		for (const button of buttons) {
			button.removeEventListener("click", handleButtonClick);
		}
	});

	render();
};
