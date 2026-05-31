const ADMIN_THEME_STORAGE_KEY = "roselt-admin-demo-theme";
const ADMIN_PROFILE_STORAGE_KEY = "adminDemoProfile_v1";
const ADMIN_PROFILE_CHANGE_EVENT = "admin-demo:profile-change";
const ADMIN_THEMES = ["dark", "light", "blue"];
const ADMIN_THEME_ALIASES = {
	stone: "light",
	mist: "light",
	midnight: "blue",
};
const ADMIN_DEFAULT_THEME = "blue";
const ADMIN_DEFAULT_PROFILE = {
	name: "John Doe",
	email: "john.doe@example.com",
	avatar: "",
	jobTitle: "Workspace Administrator",
	department: "Operations",
	location: "Cape Town, South Africa",
	timezone: "SAST (UTC+2)",
	phone: "+27 21 555 0147",
	access: "Admin, Billing, Releases",
	lastSignIn: "Today at 09:42",
	status: "Active",
	summary: "Owns workspace settings, manages access, and reviews release changes across the platform.",
};

function escapeXml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function getProfileInitials(name) {
	const parts = String(name || "")
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2);

	if (!parts.length) {
		return "JD";
	}

	return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function createProfileAvatar(name) {
	// Default avatar: outlined person (stroke-only) on a square gradient background.
	// The SVG itself is square; containers can clip it (e.g., header shows it as circle).
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${escapeXml(name)}"><defs><linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><rect width="96" height="96" fill="url(#avatarGradient)"/><g stroke="#f8fafc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.95"><circle cx="48" cy="30" r="12"/><path d="M30 68 C36 48 60 48 66 68"/></g></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function normalizeProfile(rawProfile) {
	const incoming = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
	const hasIncomingEmail = typeof incoming.email === "string" && incoming.email.trim();
	const email = hasIncomingEmail ? incoming.email.trim() : ADMIN_DEFAULT_PROFILE.email;
	const inferredName = typeof incoming.name === "string" && incoming.name.trim()
		? incoming.name.trim()
		: (hasIncomingEmail
			? (email.split("@")[0] || ADMIN_DEFAULT_PROFILE.name).replace(/[._-]/g, " ")
			: ADMIN_DEFAULT_PROFILE.name);

	// Title-case the inferred name (capitalize first letter of each word).
	const titleCasedName = String(inferredName || "")
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part[0]?.toUpperCase() + part.slice(1))
		.join(" ") || ADMIN_DEFAULT_PROFILE.name;

	return {
		...ADMIN_DEFAULT_PROFILE,
		...incoming,
		name: titleCasedName,
		email,
		avatar: typeof incoming.avatar === "string" ? incoming.avatar.trim() : "",
	};
}

(function initAdminDemoTheme() {
	const root = document.documentElement;

	function normalizeTheme(themeName) {
		const canonicalTheme = ADMIN_THEME_ALIASES[themeName] || themeName;
		return ADMIN_THEMES.includes(canonicalTheme) ? canonicalTheme : ADMIN_DEFAULT_THEME;
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

(function initAdminDemoProfile() {
	// Keep profile changes in-memory only (UI-only). Initialize from storage once,
	// but do not write back — saves will only affect the running session.
	// Start from the demo defaults and ignore any stored profile so the demo
	// remains UI-only and always shows the default outlined-person avatar.
	let inMemoryProfile = normalizeProfile(null);

	function readProfile() {
		// Always return a normalized copy so older in-memory data is corrected
		// (e.g., name capitalization inferred from email usernames).
		return normalizeProfile(inMemoryProfile);
	}

	function writeProfile(nextProfile) {
		const normalizedProfile = normalizeProfile(nextProfile);
		inMemoryProfile = normalizedProfile;

		// Notify listeners, but do not persist to localStorage.
		document.dispatchEvent(new CustomEvent(ADMIN_PROFILE_CHANGE_EVENT, {
			detail: {
				profile: normalizedProfile,
			},
		}));

		return normalizedProfile;
	}

	window.AdminDemoProfile = {
		eventName: ADMIN_PROFILE_CHANGE_EVENT,
		get() {
			return readProfile();
		},
		set(nextProfile) {
			return writeProfile(nextProfile);
		},
		update(patch) {
			return writeProfile({
				...readProfile(),
				...(patch && typeof patch === "object" ? patch : {}),
			});
		},
		avatar(profile) {
			const nextProfile = normalizeProfile(profile || readProfile());
			return nextProfile.avatar || createProfileAvatar(nextProfile.name);
		},
		initials(name) {
			return getProfileInitials(name);
		},
	};
})();
