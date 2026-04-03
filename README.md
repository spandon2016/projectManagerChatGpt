# Project Manager

This frontend uses Vite, React, and Vitest.

## Available Scripts

In the project directory, you can run:

### `npm start`

Starts the Vite development server.

### `npm run dev`

Alias for `npm start`.

### `npm test`

Runs the Vitest suite once in `jsdom`.

### `npm run build`

Builds the app for production into the `dist` folder.

### `npm run preview`

Serves the production build locally.

## Backend API

The frontend uses `http://localhost:5000/api` by default.

To override it, create a `.env` file with:

```env
VITE_API_URL=http://localhost:5000/api
```
