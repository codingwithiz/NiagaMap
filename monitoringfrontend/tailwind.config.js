/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: "class",
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
    theme: {
        extend: {
            colors: {
                primary: {
                    light: "#60a5fa",
                    DEFAULT: "#2563eb",
                    dark: "#1e40af",
                },
                background: "#f9fafb",
            },
        },
    },
    plugins: [],
};

