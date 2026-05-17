const ADMIN_THEME_STORAGE_KEY = "roselt-admin-demo-theme";
const ADMIN_THEMES = ["dark", "light", "blue"];
const ADMIN_DEFAULT_THEME = "blue";

(function initAdminDemoTheme() {
	const root = document.documentElement;

	function normalizeTheme(themeName) {
		return ADMIN_THEMES.includes(themeName) ? themeName : ADMIN_DEFAULT_THEME;
	}

	function applyTheme(themeName) {
		const nextTheme = normalizeTheme(themeName);
		root.setAttribute("data-admin-theme", nextTheme);

		try {
			window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, nextTheme);
		} catch (error) {
			// Ignore storage failures in file-based demos.
		}

		document.dispatchEvent(new CustomEvent("admin-demo:theme-change", {
			detail: {
				theme: nextTheme,
			},
		}));

		return nextTheme;
	}

	function readTheme() {
		return normalizeTheme(root.getAttribute("data-admin-theme") || ADMIN_DEFAULT_THEME);
	}

	let storedTheme = ADMIN_DEFAULT_THEME;

	try {
		storedTheme = normalizeTheme(window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY));
	} catch (error) {
		storedTheme = ADMIN_DEFAULT_THEME;
	}

	applyTheme(storedTheme);

	window.AdminDemoTheme = {
		all() {
			return [...ADMIN_THEMES];
		},
		get() {
			return readTheme();
		},
		set(themeName) {
			return applyTheme(themeName);
		},
	};
})();
