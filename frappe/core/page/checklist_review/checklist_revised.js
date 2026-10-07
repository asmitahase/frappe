frappe.provide("frappe.ui");

/**
 * frappe.ui.Checklist with the review changes applied. Only the methods that differ from
 * the base class are here; "Pin N" refers to the numbered comments on the Checklist Review
 * page. Pins 1, 2, 3, 10 (hover, min height) and 11 are CSS only (checklist_revised.css).
 *
 * Extra options on top of ChecklistOpts:
 *   outline   {boolean} Surface-base card with a 1px outline instead of the gray card.
 *   row_click {boolean} Rows run their main action on click and end in a chevron.
 */
frappe.ui.ChecklistRevised = class ChecklistRevised extends frappe.ui.Checklist {
	static CONTROLS = ".es-checklist__owner, .es-checklist__due, .es-checklist__menu";

	// Root class that scopes checklist_revised.css (all pins).
	constructor(opts = {}) {
		super({
			...opts,
			css_class: ["es-checklist--revised", opts.css_class].filter(Boolean).join(" "),
		});
		this.apply_options();
	}

	// New: flip outline / row_click on a live card (the page toggles). Pin 10 (chevron rows).
	set_options(changes) {
		Object.assign(this.opts, changes);
		this.set_items([...this.items.values()]);
		this.apply_options();
	}

	apply_options() {
		this.el.toggleAttribute("data-outline", Boolean(this.opts.outline));
		this.el.toggleAttribute("data-row-click", Boolean(this.opts.row_click));
	}

	// Pin 6 (focusable lock with a tooltip), pin 10 (row click); the description tooltip has no pin.
	make_row(item) {
		const row = super.make_row(item);
		const label = row.querySelector(".es-checklist__label");
		if (item.description) {
			label.removeAttribute("title");
			label.setAttribute("data-desc", "");
			frappe.ui.tooltip(label, { text: item.description });
		}
		frappe.ui.tooltip(row.querySelector(".es-checklist__marker"), { text: "" });
		if (this.opts.row_click) this.make_row_click(row, item);
		return row;
	}

	// Pin 10: clicking a row runs its main action; the action's tooltip points at the chevron.
	make_row_click(row, item) {
		const controls = frappe.ui.ChecklistRevised.CONTROLS;
		let waiting = false;
		const tip = () => (this.row_tips ||= new Map()).get(row);

		row.addEventListener("click", (e) => {
			if (!e.target.closest(controls)) this.run_main_action(item);
		});
		row.addEventListener("keydown", (e) => {
			if (e.target === row && (e.key === "Enter" || e.key === " ")) {
				e.preventDefault();
				this.run_main_action(item);
			}
		});

		// The label tip (data-desc) and the controls show their own, so the action tip steps aside.
		row.addEventListener("pointerover", (e) => {
			const hit = e.target.closest(`${controls}, .es-checklist__label[data-desc]`);
			if (hit) {
				waiting = false;
				tip()?.hide();
			} else if (!waiting) {
				waiting = true;
				tip()?.onenter();
			}
		});
		row.addEventListener("pointerleave", () => {
			waiting = false;
			tip()?.hide();
		});
		row.addEventListener("focus", () => {
			if (row.matches(":focus-visible")) tip()?.schedule(0);
		});
		row.addEventListener("blur", () => tip()?.hide());
		row.addEventListener("pointerdown", () => tip()?.hide());
	}

	run_main_action(item) {
		if (this.rows.get(item)?.hasAttribute("data-click")) {
			item.actions[0].onclick?.(item, this);
		}
	}

	// Pin 6 (value, not the lock reason), pin 10 (clickable rows only).
	update_row(item) {
		super.update_row(item);
		const row = this.rows.get(item);
		const reason = this.is_finished(item) ? null : item.locked;

		row.querySelector(".es-checklist__meta").textContent = [
			item.value,
			item.status === "skipped" && __("Skipped"),
		]
			.filter(Boolean)
			.join(", ");

		this.update_lock(row, reason);
		if (this.opts.row_click) this.update_row_click(item, row, reason);
	}

	// Pin 6: the lock explains itself on hover and focus.
	update_lock(row, reason) {
		const marker = row.querySelector(".es-checklist__marker");
		if (reason) {
			marker.setAttribute("tabindex", "0");
			marker.setAttribute("role", "img");
			marker.setAttribute("aria-label", reason);
		} else {
			["tabindex", "role", "aria-label"].forEach((name) => marker.removeAttribute(name));
		}
		$(marker).data("es-tooltip").set_text(reason || "");
	}

	// Pin 10: only open rows respond; locked, skipped and action-less rows keep a faded chevron.
	update_row_click(item, row, reason) {
		const action = item.actions?.[0];
		const clickable = Boolean(action) && !reason && item.status !== "skipped";
		row.toggleAttribute("data-click", clickable);
		if (clickable) {
			row.setAttribute("tabindex", "0");
			row.setAttribute("aria-label", action.label);
		} else {
			row.removeAttribute("tabindex");
			row.removeAttribute("aria-label");
		}

		const tips = (this.row_tips ||= new Map());
		tips.get(row)?.destroy();
		tips.delete(row);
		const chevron = row.querySelector(".es-checklist__go");
		if (clickable && chevron) tips.set(row, new frappe.ui.Tooltip(chevron, { text: action.label }));
	}

	// Pins 7 (menu), 8 (no main action on skipped rows), 9 (no icons), 10 (chevron).
	make_actions(item, locked) {
		const elements = [];
		const skipped = item.status === "skipped";
		if (skipped || (item.skippable && (item.status || "pending") === "pending")) {
			elements.push(this.make_menu(item));
		}

		if (this.opts.row_click) {
			if (item.actions?.length) {
				const chevron = document.createElement("span");
				chevron.className = "es-checklist__go";
				chevron.innerHTML = frappe.utils.icon("chevron-right", "sm", "", "", "", true);
				elements.push(chevron);
			}
		} else if (!skipped) {
			for (const action of item.actions || []) {
				const { icon, icon_left, icon_right, ...plain } = action;
				elements.push(
					frappe.ui.button({
						...plain,
						size: action.size || "sm",
						variant: action.variant || "subtle",
						disabled: locked || action.disabled,
						onclick: () => action.onclick?.(item, this),
					})[0]
				);
			}
		}
		return elements;
	}

	// Pin 7: Skip lives in a ⋯ menu, which adds Undo skip. No confirm: it is reversible.
	make_menu(item) {
		const $button = frappe.ui.button({
			variant: "ghost",
			icon: "ellipsis",
			tooltip: __("More actions"),
			css_class: "es-checklist__menu",
		});
		const refocus = () =>
			requestAnimationFrame(() =>
				this.rows.get(item)?.querySelector(".es-checklist__menu")?.focus()
			);
		new frappe.ui.Dropdown({
			trigger: $button,
			align: "end",
			options: () =>
				item.status === "skipped"
					? [
							{
								label: __("Undo skip"),
								onclick: () => {
									this.set_status(item.id, "pending");
									refocus();
								},
							},
					  ]
					: [
							{
								label: __("Skip"),
								onclick: () => this.skip(item).then(refocus),
							},
					  ],
		});
		return $button[0];
	}

	// Pin 4: owner and date are ghost buttons with a tooltip, not bare text.
	make_trigger($content, label) {
		const trigger = document.createElement("button");
		trigger.className = "es-checklist__control";
		frappe.ui.button.dress(trigger, { variant: "ghost" });
		trigger.setAttribute("aria-label", label);
		trigger.append(...$content.toArray());
		frappe.ui.tooltip(trigger, { text: label });
		return trigger;
	}

	// Pin 4: the owner button is icon-only, 28px square.
	make_owner(item) {
		const owner = super.make_owner(item);
		if (owner.matches?.(".es-checklist__control")) owner.setAttribute("data-icon-button", "true");
		return owner;
	}

	// Pin 5: the popover holds the field alone, no label and no second layer of padding.
	attach_editor(trigger, item, editor) {
		const popover = new frappe.ui.Popover({
			trigger,
			align: "end",
			// the panel sits in <body>, so it carries the root class to pick up the scoped CSS
			css_class: "es-checklist--revised",
			content: () => {
				const body = document.createElement("div");
				body.className = "es-checklist__field";
				const control = frappe.ui.form.make_control({
					parent: body,
					df: {
						fieldtype: editor.fieldtype,
						options: editor.options,
						label: editor.label,
						fieldname: editor.field,
						onchange: () => {
							const value = control.get_value() || null;
							if (value === (editor.value || null)) return;
							Promise.resolve(editor.save(value)).then(() => {
								popover.close();
								this.update_item(item.id, { [editor.field]: value });
							});
						},
					},
					render_input: true,
				});
				control.$input?.attr("aria-label", editor.label);
				control.set_value(editor.value || "");
				return body;
			},
		});
	}
};
