/* ---- checklist_revised.js ---- */
{% include "frappe/core/page/checklist_review/checklist_revised.js" %}

/* ---- checklist_revised.css (injected once, as text) ---- */
frappe.ui.ChecklistRevised.css = `
{% include "frappe/core/page/checklist_review/checklist_revised.css" %}
`;

/* ---- checklist_review page ---- */
frappe.pages["checklist-review"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Checklist Review"),
		single_column: true,
	});

	if (!document.getElementById("checklist-revised-css")) {
		const style = document.createElement("style");
		style.id = "checklist-revised-css";
		style.textContent = frappe.ui.ChecklistRevised.css;
		document.head.appendChild(style);
	}

	// ---- fixtures: one factory, called once per card so nothing is shared ----
	function make_items() {
		const today = frappe.datetime.get_today();
		const day = (n) => frappe.datetime.add_days(today, n);
		const open = () => ({ label: __("Open"), icon_right: "arrow-up-right" });
		const finish = (item, list) => {
			list.set_status(item.id, "done");
			list.update_item(item.id, { actions: [open()] });
		};
		const LOCK = "Needs: Create Employee";
		const assign = (id, label, value) => ({
			id,
			label,
			value,
			due_date: day(7),
			locked: LOCK,
			skippable: true,
			actions: [{ label: __("Assign"), onclick: finish }],
		});
		return [
			{
				id: "create_user",
				label: "Create User",
				status: "done",
				value: "jane@example.com",
				assignee: frappe.session.user,
				due_date: day(-3),
				actions: [open()],
			},
			{
				id: "letter",
				label: "Appointment Letter",
				description: "Create the letter, then email it to the new hire.",
				assignee: frappe.session.user,
				due_date: day(-1),
				skippable: true,
				actions: [{ label: __("Send"), icon: "send", onclick: finish }],
			},
			{
				id: "create_employee",
				label: "Create Employee",
				due_date: day(2),
				skippable: true,
				actions: [
					{
						label: __("Create"),
						onclick: (item, list) => {
							[...list.items.values()]
								.filter((row) => row.locked === LOCK)
								.forEach((row) => list.update_item(row.id, { locked: null }));
							finish(item, list);
						},
					},
				],
			},
			assign("holiday_list", "Assign Holiday List", "India 2026"),
			assign("leave_policy", "Assign Leave Policy", "Standard"),
			assign("salary_structure", "Assign Salary Structure", "Grade B"),
			{ ...assign("shift_type", "Assign Shift Type"), status: "skipped" },
		];
	}

	const checklist_opts = () => ({
		title: __("Onboarding"),
		items: make_items(),
		on_assign: () => Promise.resolve(),
		on_due_date_change: () => Promise.resolve(),
	});

	// ---- comments ----
	const PINS = [
		{
			n: 1,
			text: "Moved the count next to the chevron. Saves a line, and the folded card looks cleaner.",
			target: ({ root }) => root.querySelector(".es-checklist__count"),
		},
		{
			n: 2,
			text: "Rounded the progress segments. I really like this one, probably a Progress component change.",
			target: ({ root }) => root.querySelector(".es-progress__segment"),
		},
		{
			n: 3,
			text: "Dates sit in one column now, so you can scan them down the list.",
			target: ({ row }) => row(2).querySelector(".es-checklist__due"),
		},
		{
			n: 4,
			text: "Owner and date are clickable but didn't look it. Made them ghost buttons (same 28px and hover as ⋯), and kept them dark on locked rows since they're still editable.",
			target: ({ row }) => row(1).querySelector(".es-checklist__owner button"),
		},
		{
			n: 5,
			text: "The date popover had double padding, plus a label repeating what you just clicked. Dropped both.",
			target: ({ row }) => row(1).querySelector(".es-checklist__due button"),
		},
		{
			n: 6,
			text: "Locked rows show their value instead of repeating 'Needs: Create Employee'. The reason is in the lock's tooltip (frappe.ui.tooltip instead of title).",
			target: ({ row }) => {
				const r = row(3);
				return r.hasAttribute("data-locked") ? r.querySelector(".es-checklist__marker") : null;
			},
		},
		{
			n: 7,
			text: "Skip moved into ⋯, with Undo skip. No confirm needed since it's reversible now.",
			target: ({ row, revised }) => {
				const r = row(1);
				if (revised) return r.querySelector(".es-checklist__menu");
				return r.getAttribute("data-status") === "pending"
					? r.querySelector(".es-checklist__actions .es-button")
					: null;
			},
		},
		{
			n: 8,
			text: "Bug: skipping a locked row clears its lock, so its button becomes clickable. Skipped rows show no action now; undo the skip first.",
			target: ({ row, revised }) => {
				const r = row(6);
				if (r.getAttribute("data-status") !== "skipped") return null;
				return r.querySelector(
					revised ? ".es-checklist__menu" : ".es-checklist__actions .es-button"
				);
			},
		},
		{
			n: 9,
			text: "Send was the only button with an icon, so I dropped it.",
			target: ({ row }) => {
				const buttons = row(1).querySelectorAll(
					".es-checklist__actions .es-button:not(.es-checklist__menu)"
				);
				return [...buttons].pop() || null;
			},
		},
		{
			n: 10,
			text: "Rows had a hover but clicking did nothing. Hover only where the row is clickable (chevron rows), plus a 44px min height so rows don't look cramped.",
			target: ({ row }) => row(4),
		},
		{
			n: 11,
			text: "At narrow width owner and date sit above the button: two lines per item instead of three.",
			target: ({ row, narrow }) => (narrow ? row(3).querySelector(".es-checklist__owner") : null),
		},
	];

	const pins_by_n = new Map(); // n -> Set of pin buttons (both cards, and the popover pin)

	function make_pin(def) {
		const pin = document.createElement("button");
		pin.type = "button";
		pin.className = "checklist-review__pin";
		pin.textContent = def.n;
		pin.setAttribute("aria-label", __("Comment {0}", [def.n]));
		pin.hidden = true;
		if (!pins_by_n.has(def.n)) pins_by_n.set(def.n, new Set());
		pins_by_n.get(def.n).add(pin);

		const twins = (on) =>
			pins_by_n.get(def.n).forEach((twin) => {
				if (twin !== pin) twin.toggleAttribute("data-twin", on);
			});
		["pointerenter", "focus"].forEach((name) => pin.addEventListener(name, () => twins(true)));
		["pointerleave", "blur"].forEach((name) => pin.addEventListener(name, () => twins(false)));
		new frappe.ui.HoverCard(pin, {
			content: def.text,
			side: "bottom",
			open_delay: 150,
			css_class: "checklist-review__comment",
		});
		return pin;
	}

	// A card with its pins. `attach` points it at a (re)built checklist.
	class PinLayer {
		constructor(stage, revised) {
			this.stage = stage;
			this.revised = revised;
			this.layer = stage.querySelector(".checklist-review__pins");
			this.pins = PINS.map((def) => ({ def, el: make_pin(def) }));
			this.layer.append(...this.pins.map((pin) => pin.el));
			this.queued = false;
			this.resize = new ResizeObserver(() => this.queue());
			this.mutation = new MutationObserver(() => this.queue());
			this.resize.observe(stage);
			window.addEventListener("resize", () => this.queue());
		}

		attach(checklist) {
			this.mutation.disconnect();
			this.checklist = checklist;
			this.resize.observe(checklist.el);
			this.mutation.observe(checklist.el, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["data-status", "data-locked", "data-collapsed", "data-click", "data-row-click"],
			});
			checklist.el.addEventListener("transitionend", () => this.queue());
			this.queue();
		}

		queue() {
			if (this.queued) return;
			this.queued = true;
			requestAnimationFrame(() => {
				this.queued = false;
				this.update();
			});
		}

		update() {
			const root = this.checklist?.el;
			if (!root) return;
			const origin = this.stage.getBoundingClientRect();
			const rows = root.querySelectorAll(".es-checklist__item");
			const ctx = {
				root,
				revised: this.revised,
				narrow: page_state.narrow,
				row: (i) => rows[i],
			};
			const folded = root.hasAttribute("data-collapsed");
			for (const { def, el } of this.pins) {
				const target = page_state.comments ? def.target(ctx) : null;
				const rect = target?.isConnected && target.getClientRects().length && target.getBoundingClientRect();
				const hidden = !rect || (folded && target.closest(".es-checklist__collapse"));
				el.hidden = Boolean(hidden);
				if (hidden) continue;
				el.style.left = `${rect.left - origin.left}px`;
				el.style.top = `${rect.top - origin.top}px`;
			}
		}
	}

	// Pin 5 also sits on an open date popover (it lives in <body>, outside both cards).
	const popover_pin = make_pin(PINS[4]);
	popover_pin.classList.add("checklist-review__pin--floating");
	document.body.appendChild(popover_pin);
	let popover_tick = 0;
	function sync_popover_pin() {
		cancelAnimationFrame(popover_tick);
		const panel = [...document.querySelectorAll(".es-popover[role=dialog]")].find(
			(el) => el.getAttribute("data-state") === "open" && el.querySelector('[data-fieldtype="Date"]')
		);
		const on = Boolean(panel) && page_state.comments && $(wrapper).is(":visible");
		popover_pin.hidden = !on;
		if (!on) return;
		const rect = panel.getBoundingClientRect();
		popover_pin.style.left = `${rect.left}px`;
		popover_pin.style.top = `${rect.top}px`;
		popover_tick = requestAnimationFrame(sync_popover_pin);
	}
	new MutationObserver(sync_popover_pin).observe(document.body, { childList: true });

	// ---- page ----
	const page_state = { narrow: false, comments: true, outline: false, row_click: false };

	$(page.main).html(`
		<div class="checklist-review">
			<div class="checklist-review__toolbar">
				<label class="checklist-review__toggle">
					<input type="checkbox" data-toggle="narrow"> <span>${__("Narrow width")}</span>
				</label>
				<label class="checklist-review__toggle">
					<input type="checkbox" data-toggle="comments" checked>
					<span>${__("{0} comments", [PINS.length])}</span>
				</label>
				<span class="checklist-review__reset"></span>
			</div>
			<div class="checklist-review__grid">
				<section class="checklist-review__col" data-col="current">
					<header class="checklist-review__head"><h3>${__("Current")}</h3></header>
					<div class="checklist-review__stage">
						<div class="checklist-review__host"></div>
						<div class="checklist-review__pins"></div>
					</div>
				</section>
				<section class="checklist-review__col" data-col="revised">
					<header class="checklist-review__head">
						<h3>${__("Revised")}</h3>
						<div class="checklist-review__controls">
							<span class="checklist-review__style"></span>
							<label class="checklist-review__toggle">
								<input type="checkbox" data-toggle="row_click"> <span>${__("Chevron rows")}</span>
							</label>
						</div>
					</header>
					<div class="checklist-review__stage">
						<div class="checklist-review__host"></div>
						<div class="checklist-review__pins"></div>
					</div>
				</section>
			</div>
		</div>`);
	const root = page.main.find(".checklist-review");
	const layers = {};
	let current, revised;

	const stage_of = (name) => root.find(`[data-col=${name}] .checklist-review__stage`)[0];
	layers.current = new PinLayer(stage_of("current"), false);
	layers.revised = new PinLayer(stage_of("revised"), true);

	function build() {
		current = new frappe.ui.Checklist(checklist_opts());
		revised = new frappe.ui.ChecklistRevised({
			...checklist_opts(),
			outline: page_state.outline,
			row_click: page_state.row_click,
		});
		root.find("[data-col=current] .checklist-review__host").empty().append(current.$el);
		root.find("[data-col=revised] .checklist-review__host").empty().append(revised.$el);
		layers.current.attach(current);
		layers.revised.attach(revised);
	}

	root.find(".checklist-review__reset").append(
		frappe.ui.button({ label: __("Reset"), onclick: build })
	);
	root.find(".checklist-review__style").append(
		new frappe.ui.TabButtons({
			label: __("Card style"),
			options: [
				{ label: __("Gray"), value: "gray" },
				{ label: __("Outline"), value: "outline" },
			],
			value: "gray",
			on_change: (value) => {
				page_state.outline = value === "outline";
				revised.set_options({ outline: page_state.outline });
			},
		}).$el
	);

	root.on("change", "[data-toggle]", (e) => {
		const name = e.target.getAttribute("data-toggle");
		page_state[name] = e.target.checked;
		if (name === "narrow") root.attr("data-narrow", e.target.checked ? "" : null);
		if (name === "row_click") revised.set_options({ row_click: e.target.checked });
		Object.values(layers).forEach((layer) => layer.queue());
		sync_popover_pin();
	});

	build();

	// the page is cached and reshown: pins in <body> must not outlive it
	$(wrapper).on("hide", () => (popover_pin.hidden = true));
};
