.PHONY: dev api web test lint migrate revision

dev:            ## Full stack via Docker
	docker compose up --build

api:            ## Backend only (local venv)
	cd backend && uvicorn app.main:app --reload

web:            ## Frontend only
	cd frontend && npm run dev

test:           ## Backend tests
	cd backend && python -m pytest -q

lint:           ## Lint both sides
	cd backend && ruff check app
	cd frontend && npm run typecheck

migrate:        ## Apply migrations
	cd backend && alembic upgrade head

revision:       ## New migration: make revision m="add users table"
	cd backend && alembic revision --autogenerate -m "$(m)"
