/* @ds-bundle: {"format":3,"namespace":"BuddgetDesignSystem_3e84a0","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"BudgetRing","sourcePath":"components/feedback/BudgetRing.jsx"},{"name":"Progress","sourcePath":"components/feedback/Progress.jsx"},{"name":"ExpenseRow","sourcePath":"components/finance/ExpenseRow.jsx"},{"name":"KPICard","sourcePath":"components/finance/KPICard.jsx"},{"name":"MoneyDisplay","sourcePath":"components/finance/MoneyDisplay.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"8a9d952491cf","components/core/Button.jsx":"eec138034714","components/core/Card.jsx":"8509292b6800","components/feedback/BudgetRing.jsx":"7a7b120da832","components/feedback/Progress.jsx":"0a05ff6900b3","components/finance/ExpenseRow.jsx":"666fbdd0ce2a","components/finance/KPICard.jsx":"1d2384e78255","components/finance/MoneyDisplay.jsx":"611addc08070","components/forms/Input.jsx":"a513adfe91ef","components/forms/Switch.jsx":"0003a3c241bf","uploads/tailwind.config.ts":"fbcbc00b6e43"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.BuddgetDesignSystem_3e84a0 = window.BuddgetDesignSystem_3e84a0 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function useBadgeStyles() {
  React.useEffect(() => {
    if (document.getElementById("bg-badge-styles")) return;
    const el = document.createElement("style");
    el.id = "bg-badge-styles";
    el.textContent = `
.bg-badge {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  width: fit-content; height: 20px; padding: 0 8px;
  font-family: var(--font-sans); font-size: 12px; font-weight: 500; line-height: 1;
  white-space: nowrap; border: 1px solid transparent;
  border-radius: var(--radius-4xl); overflow: hidden;
}
.bg-badge svg { width: 12px; height: 12px; }
.bg-badge--default { background: var(--primary); color: var(--primary-foreground); }
.bg-badge--secondary { background: var(--secondary); color: var(--secondary-foreground); }
.bg-badge--destructive { background: color-mix(in srgb, var(--destructive) 14%, transparent); color: var(--destructive); }
.bg-badge--outline { border-color: var(--border); color: var(--foreground); }
.bg-badge--green { background: color-mix(in srgb, var(--color-brand-green) 18%, transparent); color: var(--color-brand-green); }
.bg-badge--gold { background: color-mix(in srgb, var(--color-brand-gold) 20%, transparent); color: var(--color-brand-gold); }
.bg-badge--amber { background: color-mix(in srgb, var(--color-brand-amber) 18%, transparent); color: var(--color-brand-amber); }
`;
    document.head.appendChild(el);
  }, []);
}

/**
 * Small pill label. Tinted semantic variants (green / gold / amber) match the
 * money-color system; default is a solid red pill.
 */
function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}) {
  useBadgeStyles();
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `bg-badge bg-badge--${variant} ${className}`.trim()
  }, props), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Inject the component's stylesheet once per document. */
function useButtonStyles() {
  React.useEffect(() => {
    if (document.getElementById("bg-button-styles")) return;
    const el = document.createElement("style");
    el.id = "bg-button-styles";
    el.textContent = `
.bg-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; white-space: nowrap; flex-shrink: 0;
  font-family: var(--font-sans); font-weight: 500;
  border: 1px solid transparent; border-radius: var(--radius-lg);
  cursor: pointer; user-select: none; outline: none;
  transition: background-color .2s var(--ease-standard), color .2s, border-color .2s, transform .05s, box-shadow .2s;
}
.bg-btn:active:not(:disabled) { transform: translateY(1px); }
.bg-btn:focus-visible { border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent); }
.bg-btn:disabled { pointer-events: none; opacity: .5; }
.bg-btn svg { width: 1em; height: 1em; flex-shrink: 0; }

/* sizes */
.bg-btn--xs { height: 24px; padding: 0 8px; font-size: 12px; border-radius: var(--radius-md); }
.bg-btn--sm { height: 28px; padding: 0 10px; font-size: 13px; border-radius: var(--radius-md); }
.bg-btn--default { height: 32px; padding: 0 10px; font-size: 14px; }
.bg-btn--lg { height: 36px; padding: 0 14px; font-size: 14px; }
.bg-btn--icon { height: 32px; width: 32px; padding: 0; }
.bg-btn--icon-lg { height: 44px; width: 44px; padding: 0; }

/* variants */
.bg-btn--default-v { background: var(--primary); color: var(--primary-foreground); }
.bg-btn--default-v:hover:not(:disabled) { background: var(--color-brand-red-hover); }
.bg-btn--outline { background: var(--background); border-color: var(--border); color: var(--foreground); }
.bg-btn--outline:hover:not(:disabled) { background: var(--muted); }
.bg-btn--secondary { background: var(--secondary); color: var(--secondary-foreground); }
.bg-btn--secondary:hover:not(:disabled) { background: color-mix(in srgb, var(--secondary) 80%, transparent); }
.bg-btn--ghost { background: transparent; color: var(--foreground); }
.bg-btn--ghost:hover:not(:disabled) { background: var(--muted); }
.bg-btn--destructive { background: color-mix(in srgb, var(--destructive) 12%, transparent); color: var(--destructive); }
.bg-btn--destructive:hover:not(:disabled) { background: color-mix(in srgb, var(--destructive) 22%, transparent); }
.bg-btn--link { background: transparent; color: var(--primary); text-underline-offset: 4px; }
.bg-btn--link:hover:not(:disabled) { text-decoration: underline; }
`;
    document.head.appendChild(el);
  }, []);
}

/**
 * Buddget primary button. Built on the brand red with five supporting variants.
 */
function Button({
  variant = "default",
  size = "default",
  startIcon,
  endIcon,
  className = "",
  children,
  ...props
}) {
  useButtonStyles();
  const variantClass = variant === "default" ? "bg-btn--default-v" : `bg-btn--${variant}`;
  return /*#__PURE__*/React.createElement("button", _extends({
    className: `bg-btn bg-btn--${size} ${variantClass} ${className}`.trim()
  }, props), startIcon, children, endIcon);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function useCardStyles() {
  React.useEffect(() => {
    if (document.getElementById("bg-card-styles")) return;
    const el = document.createElement("style");
    el.id = "bg-card-styles";
    el.textContent = `
.bg-card {
  font-family: var(--font-sans); color: var(--color-brand-text-primary);
  border-radius: var(--radius-2xl); padding: 20px;
  transition: box-shadow .2s var(--ease-standard), transform .2s var(--ease-standard);
}
.bg-card--solid { background: var(--color-brand-card); border: 1px solid var(--color-brand-border); }
.bg-card--glass {
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur));
}
.bg-card--interactive { cursor: pointer; }
.bg-card--interactive:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }
`;
    document.head.appendChild(el);
  }, []);
}

/**
 * Buddget surface container. `glass` is the signature blurred surface used for
 * dashboard widgets; `solid` is the plain card. Set `interactive` for the
 * hover-lift used on tappable KPI cards.
 */
function Card({
  variant = "glass",
  interactive = false,
  className = "",
  style,
  children,
  ...props
}) {
  useCardStyles();
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `bg-card bg-card--${variant} ${interactive ? "bg-card--interactive" : ""} ${className}`.trim(),
    style: style
  }, props), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/feedback/BudgetRing.jsx
try { (() => {
/**
 * Circular budget-usage ring — the dashboard hero's signature gauge.
 * Red arc on a faint track with a percent + label stacked in the center.
 */
function BudgetRing({
  percent = 0,
  size = 60,
  stroke = 4.5,
  label = "used",
  color = "var(--color-brand-red)"
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: size,
      height: size,
      flexShrink: 0
    },
    "aria-hidden": true
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "rgba(128,128,150,0.18)",
    strokeWidth: stroke
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeDasharray: c,
    strokeDashoffset: offset,
    strokeLinecap: "round",
    transform: `rotate(-90 ${size / 2} ${size / 2})`,
    style: {
      transition: "stroke-dashoffset 1s var(--ease-standard)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
      fontFamily: "var(--font-sans)",
      color: "var(--color-brand-text-primary)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: size * 0.25,
      fontWeight: 600
    }
  }, clamped, "%"), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: size * 0.13,
      marginTop: 2,
      color: "var(--color-brand-text-muted)"
    }
  }, label) : null));
}
Object.assign(__ds_scope, { BudgetRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/BudgetRing.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Progress.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function useProgressStyles() {
  React.useEffect(() => {
    if (document.getElementById("bg-progress-styles")) return;
    const el = document.createElement("style");
    el.id = "bg-progress-styles";
    el.textContent = `
.bg-progress-track {
  position: relative; width: 100%; overflow: hidden;
  border-radius: 999px; background: var(--color-brand-border);
}
.bg-progress-ind { height: 100%; border-radius: 999px; transition: width 1s var(--ease-standard); }
`;
    document.head.appendChild(el);
  }, []);
}
const TONE = {
  red: "var(--color-brand-red)",
  green: "var(--color-brand-green)",
  gold: "var(--color-brand-gold)",
  amber: "var(--color-brand-amber)"
};

/**
 * Linear progress / budget-usage bar. Used under debt cards and category
 * spending rows. `tone` picks the indicator color; `height` defaults to 8px.
 */
function Progress({
  value = 0,
  tone = "red",
  height = 8,
  className = "",
  ...props
}) {
  useProgressStyles();
  const pct = Math.max(0, Math.min(100, value));
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `bg-progress-track ${className}`.trim(),
    style: {
      height
    },
    role: "progressbar",
    "aria-valuenow": Math.round(pct),
    "aria-valuemin": 0,
    "aria-valuemax": 100
  }, props), /*#__PURE__*/React.createElement("div", {
    className: "bg-progress-ind",
    style: {
      width: `${pct}%`,
      background: TONE[tone] || TONE.red
    }
  }));
}
Object.assign(__ds_scope, { Progress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Progress.jsx", error: String((e && e.message) || e) }); }

// components/finance/KPICard.jsx
try { (() => {
const VALUE_TONE = {
  default: "var(--color-brand-text-primary)",
  green: "var(--color-brand-green)",
  red: "var(--color-brand-red)",
  gold: "var(--color-brand-gold)"
};

/**
 * Compact stat tile for the dashboard grid — uppercase micro-label, big mono
 * value, optional trend line. Glass surface with the hover-lift.
 */
function KPICard({
  title,
  value,
  icon,
  tone = "default",
  trend,
  trendLabel,
  onClick,
  className = ""
}) {
  const interactive = !!onClick;
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    className: `glass-card ${className}`.trim(),
    style: {
      borderRadius: "var(--radius-2xl)",
      padding: 16,
      fontFamily: "var(--font-sans)",
      cursor: interactive ? "pointer" : "default",
      transition: "transform .2s var(--ease-standard), box-shadow .2s var(--ease-standard)",
      transform: interactive && hover ? "translateY(-2px)" : "none",
      boxShadow: interactive && hover ? "var(--shadow-card-hover)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
      color: "var(--color-brand-text-secondary)"
    }
  }, icon, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: ".06em"
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    className: "font-mono-numbers",
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: VALUE_TONE[tone] || VALUE_TONE.default
    }
  }, value), (trend !== undefined || trendLabel) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--color-brand-text-muted)",
      marginTop: 4
    }
  }, trend !== undefined && /*#__PURE__*/React.createElement("span", {
    style: {
      marginInlineEnd: 4,
      color: trend >= 0 ? "var(--color-brand-green)" : "var(--color-brand-red)"
    }
  }, trend >= 0 ? "↑" : "↓", " ", Math.abs(trend), "%"), trendLabel));
}
Object.assign(__ds_scope, { KPICard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/KPICard.jsx", error: String((e && e.message) || e) }); }

// components/finance/MoneyDisplay.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONE = {
  default: "var(--color-brand-text-primary)",
  green: "var(--color-brand-green)",
  red: "var(--color-brand-red)",
  gold: "var(--color-brand-gold)",
  muted: "var(--color-brand-text-muted)"
};
function format(amount, currency) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
}

/**
 * Currency amount rendered in tabular mono figures. Optionally shows a
 * converted secondary amount underneath. `tone` colors the primary value.
 */
function MoneyDisplay({
  amount,
  currency = "AED",
  tone = "default",
  size = 16,
  secondary,
  className = "",
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: className,
    style: {
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "flex-end",
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("span", {
    className: "font-mono-numbers",
    style: {
      fontSize: size,
      fontWeight: 600,
      lineHeight: 1.1,
      color: TONE[tone] || TONE.default
    }
  }, format(amount, currency)), secondary ? /*#__PURE__*/React.createElement("span", {
    className: "font-mono-numbers",
    style: {
      fontSize: Math.max(10, size * 0.75),
      color: "var(--color-brand-text-muted)",
      marginTop: 2
    }
  }, "(", format(secondary.amount, secondary.currency), ")") : null);
}
Object.assign(__ds_scope, { MoneyDisplay });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/MoneyDisplay.jsx", error: String((e && e.message) || e) }); }

// components/finance/ExpenseRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * A single transaction row — rounded icon chip, description + category, and a
 * right-aligned amount with payment method. Hover tint matches the product's
 * list rows. Pass a Lucide icon via `icon`; `iconBg` / `iconColor` tint the chip.
 */
function ExpenseRow({
  icon,
  iconBg = "var(--color-brand-elevated)",
  iconColor = "var(--color-brand-text-secondary)",
  description,
  category,
  amount,
  currency = "AED",
  method,
  className = "",
  ...props
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    className: className,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px",
      borderRadius: "var(--radius-lg)",
      fontFamily: "var(--font-sans)",
      background: hover ? "var(--color-brand-elevated)" : "transparent",
      transition: "background-color .15s var(--ease-standard)"
    }
  }, props), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 36,
      height: 36,
      flexShrink: 0,
      borderRadius: "var(--radius-lg)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: iconBg,
      color: iconColor
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--color-brand-text-primary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, description), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--color-brand-text-muted)"
    }
  }, category)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "end"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.MoneyDisplay, {
    amount: amount,
    currency: currency,
    size: 14
  }), method ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "var(--color-brand-text-muted)",
      marginTop: 2
    }
  }, method) : null));
}
Object.assign(__ds_scope, { ExpenseRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/ExpenseRow.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function useInputStyles() {
  React.useEffect(() => {
    if (document.getElementById("bg-input-styles")) return;
    const el = document.createElement("style");
    el.id = "bg-input-styles";
    el.textContent = `
.bg-input {
  height: 32px; width: 100%; min-width: 0;
  font-family: var(--font-sans); font-size: 16px; color: var(--foreground);
  background: transparent; border: 1px solid var(--input);
  border-radius: var(--radius-lg); padding: 4px 10px;
  outline: none; transition: border-color .15s, box-shadow .15s;
}
@media (min-width: 768px) { .bg-input { font-size: 14px; } }
.bg-input::placeholder { color: var(--muted-foreground); }
.bg-input:focus-visible { border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent); }
.bg-input:disabled { opacity: .5; cursor: not-allowed; }
.bg-input[aria-invalid="true"] { border-color: var(--destructive); box-shadow: 0 0 0 3px color-mix(in srgb, var(--destructive) 20%, transparent); }
.dark .bg-input { background: color-mix(in srgb, var(--input) 30%, transparent); }
`;
    document.head.appendChild(el);
  }, []);
}

/**
 * Text input. Matches the product: 32px tall, red focus ring, 16px text on
 * mobile (prevents iOS zoom) collapsing to 14px on desktop.
 */
function Input({
  className = "",
  ...props
}) {
  useInputStyles();
  return /*#__PURE__*/React.createElement("input", _extends({
    className: `bg-input ${className}`.trim()
  }, props));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function useSwitchStyles() {
  React.useEffect(() => {
    if (document.getElementById("bg-switch-styles")) return;
    const el = document.createElement("style");
    el.id = "bg-switch-styles";
    el.textContent = `
.bg-switch {
  position: relative; display: inline-flex; align-items: center; flex-shrink: 0;
  border: 1px solid transparent; border-radius: 999px; cursor: pointer;
  background: var(--input); transition: background-color .2s var(--ease-standard);
  padding: 0;
}
.bg-switch[data-size="default"] { width: 32px; height: 18.4px; }
.bg-switch[data-size="sm"] { width: 24px; height: 14px; }
.bg-switch[data-checked="true"] { background: var(--primary); }
.bg-switch:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent); }
.bg-switch:disabled { opacity: .5; cursor: not-allowed; }
.bg-switch-thumb {
  display: block; border-radius: 999px; background: var(--background);
  transition: transform .2s var(--ease-standard);
}
.bg-switch[data-size="default"] .bg-switch-thumb { width: 16px; height: 16px; }
.bg-switch[data-size="sm"] .bg-switch-thumb { width: 12px; height: 12px; }
.bg-switch[data-checked="true"] .bg-switch-thumb { transform: translateX(calc(100% - 2px)); }
.dark .bg-switch[data-checked="true"] .bg-switch-thumb { background: var(--primary-foreground); }
`;
    document.head.appendChild(el);
  }, []);
}

/**
 * Toggle switch. Controlled via `checked` / `onCheckedChange`, or uncontrolled
 * with `defaultChecked`. Red track when on.
 */
function Switch({
  size = "default",
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  className = "",
  ...props
}) {
  useSwitchStyles();
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;
  const toggle = () => {
    if (disabled) return;
    if (!isControlled) setInternal(v => !v);
    onCheckedChange?.(!on);
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "switch",
    "aria-checked": on,
    "data-checked": on,
    "data-size": size,
    disabled: disabled,
    onClick: toggle,
    className: `bg-switch ${className}`.trim()
  }, props), /*#__PURE__*/React.createElement("span", {
    className: "bg-switch-thumb"
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// uploads/tailwind.config.ts
try { (() => {
/**
 * Buddget design tokens — pairs with CSS variables in `src/app/globals.css`.
 * Loaded via `@config` in globals (Tailwind v4).
 */
/** v4: content paths are auto-detected; avoid duplicating `content` with `@config` in CSS. */
try {
  void {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          brand: {
            bg: 'var(--color-brand-bg)',
            card: 'var(--color-brand-card)',
            elevated: 'var(--color-brand-elevated)',
            border: 'var(--color-brand-border)',
            red: 'var(--color-brand-red)',
            'red-hover': 'var(--color-brand-red-hover)',
            gold: 'var(--color-brand-gold)',
            green: 'var(--color-brand-green)',
            amber: 'var(--color-brand-amber)',
            'text-primary': 'var(--color-brand-text-primary)',
            'text-secondary': 'var(--color-brand-text-secondary)',
            'text-muted': 'var(--color-brand-text-muted)'
          }
        },
        fontFamily: {
          sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
        }
      }
    }
  };
} catch {}
})(); } catch (e) { __ds_ns.__errors.push({ path: "uploads/tailwind.config.ts", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.BudgetRing = __ds_scope.BudgetRing;

__ds_ns.Progress = __ds_scope.Progress;

__ds_ns.ExpenseRow = __ds_scope.ExpenseRow;

__ds_ns.KPICard = __ds_scope.KPICard;

__ds_ns.MoneyDisplay = __ds_scope.MoneyDisplay;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Switch = __ds_scope.Switch;

})();
