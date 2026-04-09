export default function IconoLinea({ name, size = 20, color = "currentColor", stroke = 1.9 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "food":
      return (
        <svg {...common}>
          <path d="M7 3v8" />
          <path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3" />
          <path d="M7 11v10" />
          <path d="M16 3c-2 1.6-3 3.8-3 6.7V21" />
          <path d="M16 3v18" />
        </svg>
      );
    case "cart":
      return (
        <svg {...common}>
          <circle cx="9" cy="19" r="1.5" />
          <circle cx="17" cy="19" r="1.5" />
          <path d="M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6.2" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...common}>
          <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v2a2 2 0 0 0 0 5v2a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5v-2a2 2 0 0 0 0-5z" />
          <path d="M9 9h6" />
          <path d="M9 15h6" />
        </svg>
      );
    case "bus":
      return (
        <svg {...common}>
          <path d="M7 17v2" />
          <path d="M17 17v2" />
          <path d="M6 17h12a1 1 0 0 0 1-1V8c0-3-2.5-4-7-4S5 5 5 8v8a1 1 0 0 0 1 1Z" />
          <path d="M7 13h.01" />
          <path d="M17 13h.01" />
          <path d="M7 8h10" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6.5 9.5V20h11V9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case "health":
      return (
        <svg {...common}>
          <rect x="4.5" y="6" width="15" height="12" rx="3" />
          <path d="M12 9v6" />
          <path d="M9 12h6" />
        </svg>
      );
    case "shirt":
      return (
        <svg {...common}>
          <path d="m9 5 3-2 3 2 3 1.5-1.5 4-2.5-1V20h-6V9.5l-2.5 1L4 6.5Z" />
        </svg>
      );
    case "plane":
      return (
        <svg {...common}>
          <path d="M3 13 21 5l-5.5 14-3.5-5.5L7 17z" />
          <path d="M11.5 13.5 21 5" />
        </svg>
      );
    case "paw":
      return (
        <svg {...common}>
          <circle cx="7" cy="6" r="1.5" />
          <circle cx="17" cy="6" r="1.5" />
          <circle cx="4.5" cy="11" r="1.5" />
          <circle cx="19.5" cy="11" r="1.5" />
          <path d="M12 10c-3.5 0-6.5 2.5-6.5 5.5 0 2 1.5 3.5 3.5 4h6c2 -.5 3.5-2 3.5-4C18.5 12.5 15.5 10 12 10z" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="M12 3 4.5 7 12 11l7.5-4Z" />
          <path d="M4.5 7v10L12 21l7.5-4V7" />
          <path d="M12 11v10" />
        </svg>
      );
    case "arrow-in":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="m7 10 5-5 5 5" />
          <rect x="4" y="4" width="16" height="16" rx="4" />
        </svg>
      );
    case "arrow-out":
      return (
        <svg {...common}>
          <path d="M12 19V5" />
          <path d="m17 14-5 5-5-5" />
          <rect x="4" y="4" width="16" height="16" rx="4" />
        </svg>
      );
    case "split":
      return (
        <svg {...common}>
          <path d="M6 5h12" />
          <path d="M12 5v14" />
          <path d="m8.5 14 3.5 5 3.5-5" />
        </svg>
      );
    case "divide":
      return (
        <svg {...common}>
          <circle cx="12" cy="7.5" r="1.2" fill={color} stroke="none" />
          <path d="M8 12h8" />
          <circle cx="12" cy="16.5" r="1.2" fill={color} stroke="none" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M8 7h11" />
          <path d="M8 12h11" />
          <path d="M8 17h11" />
          <circle cx="4.5" cy="7" r="1" fill={color} stroke="none" />
          <circle cx="4.5" cy="12" r="1" fill={color} stroke="none" />
          <circle cx="4.5" cy="17" r="1" fill={color} stroke="none" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4.2 4.2L19 6.5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10.5 20a1.5 1.5 0 0 0 3 0" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16.5 19a4.5 4.5 0 0 0-9 0" />
          <circle cx="12" cy="10" r="3" />
          <path d="M21 19a3.8 3.8 0 0 0-3-3.7" />
          <path d="M3 19a3.8 3.8 0 0 1 3-3.7" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 12a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8L18 7" />
          <path d="M9 4h6" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M4 20h4l9.5-9.5a2.1 2.1 0 0 0-4-4L4 16z" />
          <path d="m12.5 6.5 4 4" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M18 6 6 18" />
          <path d="M6 6l12 12" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
