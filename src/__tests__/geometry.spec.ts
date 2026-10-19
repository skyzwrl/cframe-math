/// <reference types="@rbxts/testez/globals" />

import {
	closestPointOnSegment,
	closestPointsBetweenSegments,
	isPointInBox,
	perpendicularBasis,
	projectOnPlane,
	projectPointOnPlane,
	rayBox,
	rayPlane,
	raySphere,
} from "../geometry";
import { lcg, randomRotation, randomVector } from "./lcg";
import { assertNear, assertVectorNear } from "./near";

export = () => {
	describe("closestPointOnSegment", () => {
		const a = new Vector3(0, 0, 0);
		const b = new Vector3(10, 0, 0);

		it("projects onto the middle and clamps to the ends", () => {
			assertVectorNear(closestPointOnSegment(new Vector3(4, 3, -2), a, b), new Vector3(4, 0, 0), 1e-6);
			assertVectorNear(closestPointOnSegment(new Vector3(-5, 1, 0), a, b), a, 1e-6);
			assertVectorNear(closestPointOnSegment(new Vector3(15, 1, 0), a, b), b, 1e-6);
		});

		it("handles a zero-length segment", () => {
			assertVectorNear(closestPointOnSegment(new Vector3(1, 1, 1), a, a), a, 1e-6);
		});
	});

	describe("closestPointsBetweenSegments", () => {
		it("finds the common perpendicular of skew segments", () => {
			const result = closestPointsBetweenSegments(
				new Vector3(-1, 0, 0),
				new Vector3(1, 0, 0),
				new Vector3(0, -1, 2),
				new Vector3(0, 1, 2),
			);
			assertVectorNear(result.pointA, Vector3.zero, 1e-6);
			assertVectorNear(result.pointB, new Vector3(0, 0, 2), 1e-6);
			assertNear(result.distance, 2, 1e-9);
		});

		it("returns zero for crossing segments and the gap for parallel ones", () => {
			const crossing = closestPointsBetweenSegments(
				new Vector3(-1, 0, 0),
				new Vector3(1, 0, 0),
				new Vector3(0, -1, 0),
				new Vector3(0, 1, 0),
			);
			assertNear(crossing.distance, 0, 1e-9);

			const parallel = closestPointsBetweenSegments(
				new Vector3(0, 0, 0),
				new Vector3(4, 0, 0),
				new Vector3(1, 1, 0),
				new Vector3(3, 1, 0),
			);
			assertNear(parallel.distance, 1, 1e-9);
		});

		it("clamps to endpoints and copes with points", () => {
			const pastTheEnd = closestPointsBetweenSegments(
				Vector3.zero,
				new Vector3(1, 0, 0),
				new Vector3(5, 0, 3),
				new Vector3(5, 0, 6),
			);
			assertVectorNear(pastTheEnd.pointA, new Vector3(1, 0, 0), 1e-6);
			assertVectorNear(pastTheEnd.pointB, new Vector3(5, 0, 3), 1e-6);

			const points = closestPointsBetweenSegments(Vector3.one, Vector3.one, Vector3.zero, Vector3.zero);
			assertNear(points.distance, math.sqrt(3), 1e-6);
		});

		it("is never beaten by brute force sampling", () => {
			const rng = lcg(7);
			for (let trial = 0; trial < 20; trial++) {
				const p1 = randomVector(rng, 10);
				const q1 = randomVector(rng, 10);
				const p2 = randomVector(rng, 10);
				const q2 = randomVector(rng, 10);
				const result = closestPointsBetweenSegments(p1, q1, p2, q2);

				let best = math.huge;
				for (let i = 0; i <= 60; i++) {
					const a = p1.Lerp(q1, i / 60);
					for (let j = 0; j <= 60; j++) {
						best = math.min(best, a.sub(p2.Lerp(q2, j / 60)).Magnitude);
					}
				}

				expect(result.distance <= best + 1e-4).to.equal(true);
				expect(result.s >= 0 && result.s <= 1 && result.t >= 0 && result.t <= 1).to.equal(true);
				assertNear(result.pointA.sub(result.pointB).Magnitude, result.distance, 1e-4);
			}
		});
	});

	describe("rayPlane", () => {
		it("hits a plane in front with the normal facing the ray", () => {
			const hit = rayPlane(new Vector3(0, 10, 0), new Vector3(1, -2, 0), Vector3.zero, Vector3.yAxis)!;
			assertNear(hit.t, 5, 1e-9);
			assertVectorNear(hit.position, new Vector3(5, 0, 0), 1e-6);
			assertVectorNear(hit.normal, Vector3.yAxis, 1e-6);

			const fromBelow = rayPlane(new Vector3(0, -10, 0), Vector3.yAxis, Vector3.zero, Vector3.yAxis)!;
			assertVectorNear(fromBelow.normal, Vector3.yAxis.mul(-1), 1e-6);
		});

		it("misses parallel rays and planes behind the origin", () => {
			expect(rayPlane(Vector3.one, Vector3.xAxis, Vector3.zero, Vector3.yAxis)).never.to.be.ok();
			expect(rayPlane(new Vector3(0, 5, 0), Vector3.yAxis, Vector3.zero, Vector3.yAxis)).never.to.be.ok();
		});
	});

	describe("raySphere", () => {
		const center = new Vector3(10, 0, 0);

		it("hits the near side with an outward normal", () => {
			const hit = raySphere(Vector3.zero, Vector3.xAxis, center, 2)!;
			assertNear(hit.t, 8, 1e-9);
			assertVectorNear(hit.normal, Vector3.xAxis.mul(-1), 1e-6);
			expect(hit.inside).to.equal(false);
		});

		it("misses spheres beside or behind the ray", () => {
			expect(raySphere(Vector3.zero, Vector3.yAxis, center, 2)).never.to.be.ok();
			expect(raySphere(Vector3.zero, Vector3.xAxis.mul(-1), center, 2)).never.to.be.ok();
		});

		it("reports a hit at t = 0 when starting inside", () => {
			const hit = raySphere(new Vector3(10.5, 0, 0), Vector3.yAxis, center, 2)!;
			expect(hit.inside).to.equal(true);
			expect(hit.t).to.equal(0);
		});

		it("keeps precision for a far away sphere", () => {
			const hit = raySphere(Vector3.zero, Vector3.xAxis, new Vector3(1e6, 0, 0), 1)!;
			assertNear(hit.t, 1e6 - 1, 1e-3);
		});
	});

	describe("rayBox", () => {
		it("hits an axis aligned box on the right face", () => {
			const hit = rayBox(new Vector3(-10, 0.5, 0), Vector3.xAxis, CFrame.identity, new Vector3(2, 2, 2))!;
			assertNear(hit.t, 9, 1e-5);
			assertVectorNear(hit.normal, Vector3.xAxis.mul(-1), 1e-6);
		});

		it("agrees with marching along the ray for rotated boxes", () => {
			const rng = lcg(8);
			for (let trial = 0; trial < 30; trial++) {
				const box = new CFrame(randomVector(rng, 5)).mul(randomRotation(rng));
				const size = new Vector3(1 + rng() * 4, 1 + rng() * 4, 1 + rng() * 4);
				const origin = randomVector(rng, 15).add(new Vector3(0, 0, 30));
				const towards = box.Position.add(randomVector(rng, 0.5)).sub(origin).Unit;
				const direction = trial % 3 === 0 ? towards.mul(-1) : towards;

				let marched: number | undefined;
				for (let step = 0; step <= 6000; step++) {
					if (isPointInBox(origin.add(direction.mul(step * 0.01)), box, size)) {
						marched = step * 0.01;
						break;
					}
				}

				const hit = rayBox(origin, direction, box, size);
				expect(hit !== undefined).to.equal(marched !== undefined);
				if (hit && marched !== undefined) {
					assertNear(hit.t, marched, 0.011);
					expect(hit.normal.Dot(direction) < 0).to.equal(true);
					expect(isPointInBox(hit.position.sub(hit.normal.mul(1e-3)), box, size)).to.equal(true);
					expect(isPointInBox(hit.position.add(hit.normal.mul(1e-3)), box, size)).to.equal(false);
				}
			}
		});

		it("handles rays parallel to a face and starting inside", () => {
			const size = new Vector3(2, 2, 2);
			expect(rayBox(new Vector3(-5, 3, 0), Vector3.xAxis, CFrame.identity, size)).never.to.be.ok();
			expect(rayBox(new Vector3(-5, 1, 0), Vector3.xAxis, CFrame.identity, size)).to.be.ok();
			expect(rayBox(new Vector3(5, 0, 0), Vector3.xAxis, CFrame.identity, size)).never.to.be.ok();

			const inside = rayBox(new Vector3(0.2, 0, 0), Vector3.zAxis, CFrame.identity, size)!;
			expect(inside.inside).to.equal(true);
			expect(inside.t).to.equal(0);
		});
	});

	describe("planes and boxes", () => {
		it("projects vectors and points onto planes", () => {
			const normal = new Vector3(1, 2, -2);
			const projected = projectOnPlane(new Vector3(4, -1, 7), normal);
			assertNear(projected.Dot(normal), 0, 1e-5);

			const planePoint = new Vector3(3, 3, 3);
			const point = new Vector3(-2, 8, 1);
			const onPlane = projectPointOnPlane(point, planePoint, normal);
			assertNear(onPlane.sub(planePoint).Dot(normal), 0, 1e-4);
			assertNear(point.sub(onPlane).Unit.Cross(normal.Unit).Magnitude, 0, 1e-5);
		});

		it("tests points against oriented boxes", () => {
			const box = new CFrame(0, 5, 0).mul(CFrame.Angles(0, math.pi / 4, 0));
			const size = new Vector3(4, 2, 2);
			expect(isPointInBox(box.PointToWorldSpace(new Vector3(1.9, 0.9, -0.9)), box, size)).to.equal(true);
			expect(isPointInBox(box.PointToWorldSpace(new Vector3(2.1, 0, 0)), box, size)).to.equal(false);
			expect(isPointInBox(new Vector3(1.9, 5, 0), box, size)).to.equal(false);
		});

		it("builds an orthonormal basis around any normal", () => {
			const rng = lcg(9);
			const normals = [Vector3.zAxis, Vector3.zAxis.mul(-1), Vector3.xAxis, new Vector3(0, 1e-7, -1)];
			for (let index = 0; index < 30; index++) {
				normals.push(randomVector(rng));
			}

			for (const normal of normals) {
				const n = normal.Unit;
				const { tangent, bitangent } = perpendicularBasis(normal);
				assertNear(tangent.Magnitude, 1, 1e-5);
				assertNear(bitangent.Magnitude, 1, 1e-5);
				assertNear(tangent.Dot(n), 0, 1e-5);
				assertNear(bitangent.Dot(n), 0, 1e-5);
				assertVectorNear(tangent.Cross(bitangent), n, 1e-5);
			}
		});
	});
};
