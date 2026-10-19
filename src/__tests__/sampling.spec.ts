/// <reference types="@rbxts/testez/globals" />

import { isPointInBox } from "../geometry";
import { vectorAngle } from "../orientation";
import { randomInAnnulus, randomInBox, randomInCone, randomInDisk, randomInSphere, randomOnSphere } from "../sampling";
import { lcg } from "./lcg";
import { assertNear } from "./near";

const SAMPLES = 20000;

export = () => {
	describe("randomOnSphere", () => {
		it("spreads unit vectors evenly", () => {
			const rng = lcg(11);
			let sumZ = 0;
			let sumAbsZ = 0;
			let sumX = 0;
			for (let index = 0; index < SAMPLES; index++) {
				const point = randomOnSphere(rng);
				assertNear(point.Magnitude, 1, 1e-5);
				sumZ += point.Z;
				sumAbsZ += math.abs(point.Z);
				sumX += point.X;
			}

			assertNear(sumZ / SAMPLES, 0, 0.02);
			assertNear(sumX / SAMPLES, 0, 0.02);
			// z of a uniform point on a sphere is uniform on [-1, 1], so |z| averages 1/2
			assertNear(sumAbsZ / SAMPLES, 0.5, 0.01);
		});
	});

	describe("randomInSphere", () => {
		it("fills the volume evenly instead of crowding the centre", () => {
			const rng = lcg(12);
			const center = new Vector3(5, -3, 2);
			let innerHalf = 0;
			for (let index = 0; index < SAMPLES; index++) {
				const distance = randomInSphere(center, 4, rng).sub(center).Magnitude;
				expect(distance <= 4 + 1e-4).to.equal(true);
				if (distance < 2) {
					innerHalf++;
				}
			}
			assertNear(innerHalf / SAMPLES, 0.125, 0.01);
		});
	});

	describe("randomInDisk and randomInAnnulus", () => {
		it("stays in the plane and spreads evenly by area", () => {
			const rng = lcg(13);
			const center = new Vector3(0, 10, 0);
			for (const normal of [new Vector3(1, 1, 0), Vector3.zAxis.mul(-1)]) {
				let innerHalf = 0;
				for (let index = 0; index < SAMPLES; index++) {
					const offset = randomInDisk(center, normal, 6, rng).sub(center);
					assertNear(offset.Dot(normal.Unit), 0, 1e-4);
					expect(offset.Magnitude <= 6 + 1e-4).to.equal(true);
					if (offset.Magnitude < 3) {
						innerHalf++;
					}
				}
				assertNear(innerHalf / SAMPLES, 0.25, 0.015);
			}
		});

		it("keeps annulus points between the radii with the right area split", () => {
			const rng = lcg(14);
			let belowMiddle = 0;
			for (let index = 0; index < SAMPLES; index++) {
				const distance = randomInAnnulus(Vector3.zero, Vector3.yAxis, 2, 6, rng).Magnitude;
				expect(distance >= 2 - 1e-4 && distance <= 6 + 1e-4).to.equal(true);
				if (distance < 4) {
					belowMiddle++;
				}
			}
			assertNear(belowMiddle / SAMPLES, (16 - 4) / (36 - 4), 0.015);
		});
	});

	describe("randomInBox", () => {
		it("lands inside the oriented box, evenly on both halves", () => {
			const rng = lcg(15);
			const box = new CFrame(3, 4, 5).mul(CFrame.Angles(0.3, 1.1, -0.4));
			const size = new Vector3(6, 2, 3);
			let positiveX = 0;
			for (let index = 0; index < SAMPLES; index++) {
				const point = randomInBox(box, size, rng);
				expect(isPointInBox(point, box, size.add(new Vector3(1e-3, 1e-3, 1e-3)))).to.equal(true);
				if (box.PointToObjectSpace(point).X > 0) {
					positiveX++;
				}
			}
			assertNear(positiveX / SAMPLES, 0.5, 0.015);
		});
	});

	describe("randomInCone", () => {
		it("stays inside the cone with a uniform cap distribution", () => {
			const rng = lcg(16);
			const direction = new Vector3(1, -2, 0.5);
			const halfAngle = math.rad(15);
			let sumCosine = 0;
			for (let index = 0; index < SAMPLES; index++) {
				const sample = randomInCone(direction, halfAngle, rng);
				assertNear(sample.Magnitude, 1, 1e-5);
				expect(vectorAngle(sample, direction) <= halfAngle + 1e-4).to.equal(true);
				sumCosine += sample.Dot(direction.Unit);
			}
			assertNear(sumCosine / SAMPLES, (1 + math.cos(halfAngle)) / 2, 1e-3);
		});

		it("returns the direction itself for a zero angle", () => {
			const sample = randomInCone(new Vector3(0, 0, -5), 0, lcg(17));
			assertNear(sample.Z, -1, 1e-6);
		});
	});

	it("falls back to math.random when no generator is passed", () => {
		expect(randomOnSphere().Magnitude).to.be.near(1, 1e-5);
		expect(randomInSphere(Vector3.zero, 1).Magnitude <= 1).to.equal(true);
	});
};
