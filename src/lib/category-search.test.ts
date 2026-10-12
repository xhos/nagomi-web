import assert from "node:assert/strict";
import { test } from "node:test";
import { completeSlug, isValidSlug, searchSlugs } from "./utils/category";

const slugs = [
	"food.groceries",
	"food.dining",
	"food.coffee",
	"fun",
	"home.furniture",
	"transport.transit",
];

test("prefix matches come before matches inside a slug", () => {
	assert.deepEqual(searchSlugs(slugs, "f"), [
		"food.coffee",
		"food.dining",
		"food.groceries",
		"fun",
		"home.furniture",
	]);
	assert.deepEqual(searchSlugs(slugs, "fu"), ["fun", "home.furniture"]);
	assert.deepEqual(searchSlugs(slugs, "groc"), ["food.groceries"]);
});

test("tab completes to the shared prefix", () => {
	assert.equal(completeSlug(slugs, "fo"), "food.");
	assert.equal(completeSlug(slugs, "food.g"), "food.groceries");
	assert.equal(completeSlug(slugs, "f"), "f");
	assert.equal(completeSlug(slugs, "xyz"), "xyz");
});

test("slugs use dot notation", () => {
	assert.ok(isValidSlug("food.snacks"));
	assert.ok(!isValidSlug("food..snacks"));
	assert.ok(!isValidSlug(".food"));
	assert.ok(!isValidSlug(""));
});
