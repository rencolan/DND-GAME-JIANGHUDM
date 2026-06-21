# Jianghu DM Backend

This directory contains the standalone backend needed for remote play with a local `koboldcpp` model.

## Layout

- `service/`: public HTTP + WebSocket service that players call from the browser
- `bridge/`: local agent that runs on your PC and forwards requests into `koboldcpp`
- `shared/`: protocol helpers shared by both sides

## Runtime model

1. Deploy `service/` on a public host.
2. Run `bridge/` on the same machine as `koboldcpp`.
3. Point the game UI `API URL` to `https://your-service.example.com/v1/chat/completions`.
4. Fill `API Key` with `CLIENT_API_KEY`.
5. Fill `Model` with the model name exposed by your local `koboldcpp`.

## Environment

Copy `backend/.env.example` to `backend/.env`, then provide:

- `CLIENT_API_KEY`: used by the browser when calling the remote backend
- `BRIDGE_SECRET`: used only between the remote service and the local bridge
- `REMOTE_HTTP_BASE` / `REMOTE_WS_URL`: public address of the remote service
- `KOBOLD_BASE_URL`: local OpenAI-compatible `koboldcpp` endpoint

## Commands

Run the public service:

```bash
cd backend
npm run start:service
```

Run the local bridge on the PC that hosts `koboldcpp`:

```bash
cd backend
npm run start:bridge
```

Run tests:

```bash
cd backend
npm test
```

## Public endpoints

- `GET /healthz`
- `GET /bridge/status`
- `POST /v1/chat/completions`
- `WS /ws/bridge`

## Notes

- The service enables permissive CORS for browser access in v1.
- `stream: true` is intentionally rejected in v1.
- Requests are serialized per bridge so a single local model is not hit concurrently.

