.PHONY: all test clean
.DEFAULT_GOAL := test

test:
	npm run ci
	npm run build


