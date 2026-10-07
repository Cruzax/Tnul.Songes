// Config Tailwind (CDN) partagée par toutes les pages: à charger juste APRÈS le script Tailwind.
// Les couleurs viennent des variables de assets/css/theme.css.
tailwind.config = {
    theme: {
      extend: {
        colors: {
          panel: "rgb(var(--c-panel) / <alpha-value>)",
          panel2: "rgb(var(--c-panel2) / <alpha-value>)",
          line: "rgb(var(--c-line) / <alpha-value>)",
          ink: "rgb(var(--c-ink) / <alpha-value>)",
          muted: "rgb(var(--c-muted) / <alpha-value>)",
          accent: "rgb(var(--c-accent) / <alpha-value>)",
        },
        keyframes: {
          "detail-grid-in": {
            from: { opacity: "0.35" },
            to: { opacity: "1" },
          },
        },
        animation: {
          "detail-grid-in": "detail-grid-in 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        },
      },
    },
};
