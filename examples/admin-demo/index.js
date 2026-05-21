const ADMIN_THEME_STORAGE_KEY = "roselt-admin-demo-theme";
const ADMIN_THEMES = ["dark", "light", "blue"];
const ADMIN_DEFAULT_THEME = "blue";
const ADMIN_AUTH_PAGES = new Set(["login", "register", "forgot-password"]);
const ADMIN_AUTH_STORAGE_KEY = "adminDemoLoggedIn";

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

function getAdminPageId(url = window.location.href) {
	try {
		const resolvedUrl = url instanceof URL ? url : new URL(url, window.location.href);
		return (resolvedUrl.searchParams.get("page") || "home").trim() || "home";
	} catch (error) {
		return "home";
	}
}

function isAuthPage(pageId) {
	return ADMIN_AUTH_PAGES.has(pageId);
}

function applyAdminLayout(pageId) {
	if (!document.body) return;
	document.body.dataset.adminLayout = isAuthPage(pageId) ? "auth" : "app";
}

window.AdminDemoAuth = {
	isLoggedIn() {
		try {
			return window.localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === "1";
		} catch (error) {
			return false;
		}
	},
	setLoggedIn(isLoggedIn) {
		try {
			if (isLoggedIn) {
				window.localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, "1");
				return;
			}
			window.localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
		} catch (error) {
			// Ignore storage failures in file-based examples.
		}
	},
	logOut() {
		this.setLoggedIn(false);
	},
};

function syncAdminRouteState(url = window.location.href) {
	const pageId = getAdminPageId(url);

	if (!window.AdminDemoAuth.isLoggedIn() && !isAuthPage(pageId)) {
		window.history.replaceState({}, "", "?page=login");
		applyAdminLayout("login");
		return "login";
	}

	applyAdminLayout(pageId);
	return pageId;
}

syncAdminRouteState();

if ("navigation" in window && typeof window.navigation.addEventListener === "function") {
	window.navigation.addEventListener("navigate", (event) => {
		applyAdminLayout(getAdminPageId(event.destination?.url || window.location.href));
	});
}

// Log-out handler - clear auth state and navigate to log in
document.addEventListener('click', function (e) {
	try {
		var el = e && e.target && e.target.closest && e.target.closest('#logout-link');
		if (!el) return;
	} catch (err) {
		return;
	}
	e.preventDefault && e.preventDefault();
	window.AdminDemoAuth.logOut();
	window.location.href = '?page=login';
});
