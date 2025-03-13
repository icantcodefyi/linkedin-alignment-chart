# X Alignment Chart

Create D&D-style alignment charts for X (formerly Twitter) users. Place users on a Lawful-Chaotic and Good-Evil grid based on an AI analysis of their tweets or manually position them. Powered by [Exa](https://exa.ai/) and [Vercel AI SDK](https://sdk.vercel.ai).

Try it here! → [magic-x-alignment-chart.vercel.app](https://dub.sh/magic-x-alignment-chart/)

https://github.com/user-attachments/assets/2e5e2587-468e-4a77-ac59-742c92f8d58a

## Tutorial

1. Enter an X username in the input field
2. Choose between:
   - **AI Analysis** (purple button): Analyzes the user's tweets and places them on the chart
   - **Random Placement** (black button): Places the user randomly on the chart for manual positioning
3. View the alignment chart with positioned users
4. Drag unlocked users to reposition them (AI-placed users are locked)
5. Click on chart axis labels to learn more about each alignment


## Development Setup

1. Sign up for accounts with the AI provider you want to use (e.g., OpenAI (default), Anthropic), and obtain an API key.
2. Setup a Redis DB on [Upstash Redis](https://upstash.com/)
3. Create a `.env.local` file based on the `.env.example` template
4. `bun install` to install dependencies
5. `bun dev` to run the development server


## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ff1shy-dev%2Fx-alignment-chart)

## Credits

- Original concept by [mdmatthewdc](https://x.com/mdmathewdc/status/1899767815344722325)
- Draggable v0 by [rauchg](https://x.com/rauchg/status/1899895262023467035)
- AI version (this one) by [f1shy-dev](https://x.com/vishyfishy2/status/1899929030620598508)
