(function initAdminHeaderProfileMenu() {
	const menu = document.querySelector("[data-profile-menu]");

	if (!menu || menu.dataset.initialized === "true") {
		return;
	}

	const trigger = menu.querySelector("[data-profile-menu-trigger]");
	const dropdown = menu.querySelector("[data-profile-menu-dropdown]");

	if (!trigger || !dropdown) {
		return;
	}

	const closeMenu = function () {
		trigger.setAttribute("aria-expanded", "false");
		dropdown.hidden = true;
	};

	const openMenu = function () {
		trigger.setAttribute("aria-expanded", "true");
		dropdown.hidden = false;
	};

	trigger.addEventListener("click", function () {
		const isOpen = trigger.getAttribute("aria-expanded") === "true";

		if (isOpen) {
			closeMenu();
			return;
		}

		openMenu();
	});

	const onOutsidePointer = function (event) {
		try {
			if (!menu.contains(event.target)) {
				closeMenu();
			}
		} catch (e) {
			// ignore unexpected targets
		}
	};

	document.addEventListener("pointerdown", onOutsidePointer, { capture: true });
	document.addEventListener("touchstart", onOutsidePointer, { capture: true });

	// Close when focus leaves the menu (keyboard navigation)
	menu.addEventListener("focusout", function (event) {
		if (!menu.contains(event.relatedTarget)) {
			closeMenu();
		}
	});

	document.addEventListener("keydown", function (event) {
		if (event.key === "Escape") {
			closeMenu();
			trigger.focus();
		}
	});

	dropdown.addEventListener("click", function (event) {
		const item = event.target.closest(".profile-menu__item");

		if (item) {
			closeMenu();
		}
	});

	menu.dataset.initialized = "true";
})();

(function setAdminHeaderHeightVar() {
  const getHeader = () => document.querySelector('.admin-header');
  const updateHeaderHeight = () => {
    const header = getHeader();
    if (!header) {
      document.documentElement.style.setProperty('--admin-header-height', '0px');
      return;
    }
    const height = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--admin-header-height', height + 'px');
  };

  window.addEventListener('resize', updateHeaderHeight);

  let observer;
  const header = getHeader();
  if (header && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);
  }

  updateHeaderHeight();
  setTimeout(updateHeaderHeight, 150);

  window.addEventListener('unload', () => {
    window.removeEventListener('resize', updateHeaderHeight);
    if (observer) observer.disconnect();
  });
})();
