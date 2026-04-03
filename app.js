function makePRNG(seed) {
	let s = (seed ^ 0x5f3759df) >>> 0;
	return () => {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		return (s >>> 0) / 4294967296;
	};
}

function randomizeSeed() {
	rngSeed = Date.now() & 0x7fffffff;
}

let rngSeed = 42;
randomizeSeed();
let S = { ...PG["GOTHIC / DOOM"]["Dead End Kings"] };
let shadowHex = S.shadowH;
let highlightHex = S.highlightH;
let activePreset = "Dead End Kings";
let srcImg = null;
let renderTimer = null;

const displayCanvas = document.getElementById("displayCanvas");
const origDisplayCanvas = document.getElementById("origDisplayCanvas");
const dCtx = displayCanvas.getContext("2d");
const oCtx = origDisplayCanvas.getContext("2d");
const fullRes = document.createElement("canvas");
const frCtx = fullRes.getContext("2d");

function boxH(src, dst, w, h, r) {
	for (let y = 0; y < h; y++) {
		let sr = 0,
			sg = 0,
			sb = 0,
			c = 0;
		for (let x = -r; x <= r; x++) {
			const nx = Math.max(0, Math.min(w - 1, x)),
				i = (y * w + nx) * 4;
			sr += src[i];
			sg += src[i + 1];
			sb += src[i + 2];
			c++;
		}
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			dst[i] = sr / c;
			dst[i + 1] = sg / c;
			dst[i + 2] = sb / c;
			dst[i + 3] = src[i + 3];
			const ai = (y * w + Math.min(w - 1, x + r + 1)) * 4,
				ri = (y * w + Math.max(0, x - r)) * 4;
			sr += src[ai] - src[ri];
			sg += src[ai + 1] - src[ri + 1];
			sb += src[ai + 2] - src[ri + 2];
		}
	}
}

function boxV(src, dst, w, h, r) {
	for (let x = 0; x < w; x++) {
		let sr = 0,
			sg = 0,
			sb = 0,
			c = 0;
		for (let y = -r; y <= r; y++) {
			const ny = Math.max(0, Math.min(h - 1, y)),
				i = (ny * w + x) * 4;
			sr += src[i];
			sg += src[i + 1];
			sb += src[i + 2];
			c++;
		}
		for (let y = 0; y < h; y++) {
			const i = (y * w + x) * 4;
			dst[i] = sr / c;
			dst[i + 1] = sg / c;
			dst[i + 2] = sb / c;
			dst[i + 3] = src[i + 3];
			const ai = (Math.min(h - 1, y + r + 1) * w + x) * 4,
				ri = (Math.max(0, y - r) * w + x) * 4;
			sr += src[ai] - src[ri];
			sg += src[ai + 1] - src[ri + 1];
			sb += src[ai + 2] - src[ri + 2];
		}
	}
}

function gBlur(data, w, h, r) {
	if (r < 1) return new Uint8ClampedArray(data);
	const R = Math.round(r),
		t = new Float32Array(data.length),
		o = new Float32Array(data.length);
	boxH(data, t, w, h, R);
	boxV(t, o, w, h, R);
	boxH(o, t, w, h, R);
	boxV(t, o, w, h, R);
	const res = new Uint8ClampedArray(o.length);
	for (let i = 0; i < res.length; i++)
		res[i] = Math.max(0, Math.min(255, o[i]));
	return res;
}

function h2rgb(hex) {
	return [
		parseInt(hex.slice(1, 3), 16),
		parseInt(hex.slice(3, 5), 16),
		parseInt(hex.slice(5, 7), 16),
	];
}

function applyEffect(ctx, w, h) {
	const rng = makePRNG(rngSeed);
	const id = ctx.getImageData(0, 0, w, h),
		d = id.data;

	if (S.aberr > 0.001) {
		const shift = Math.round(S.aberr * w),
			orig = new Uint8ClampedArray(d);
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				const i = (y * w + x) * 4;
				d[i] = orig[(y * w + Math.min(w - 1, x + shift)) * 4];
				d[i + 2] = orig[(y * w + Math.max(0, x - shift)) * 4 + 2];
			}
	}

	const [sR, sG, sB] = h2rgb(shadowHex),
		[hR, hG, hB] = h2rgb(highlightHex);
	for (let i = 0; i < d.length; i += 4) {
		let r = d[i],
			g = d[i + 1],
			b = d[i + 2];
		const lum = 0.299 * r + 0.587 * g + 0.114 * b;
		r = r + (lum - r) * S.desat;
		g = g + (lum - g) * S.desat;
		b = b + (lum - b) * S.desat;
		r += S.tone * 0.4;
		b -= S.tone * 0.4;
		if (S.bleach > 0) {
			const bl = 0.299 * r + 0.587 * g + 0.114 * b;
			r = r + (bl - r) * S.bleach * 0.5;
			g = g + (bl - g) * S.bleach * 0.5;
			b = b + (bl - b) * S.bleach * 0.5;
			const ov = (c, l) =>
				l < 128
					? (2 * c * l) / 255
					: 255 - (2 * (255 - c) * (255 - l)) / 255;
			r = r + (ov(r, bl) - r) * S.bleach * 0.5;
			g = g + (ov(g, bl) - g) * S.bleach * 0.5;
			b = b + (ov(b, bl) - b) * S.bleach * 0.5;
		}
		r *= S.brt;
		g *= S.brt;
		b *= S.brt;
		const cf = (S.cont - 1) * 128;
		r = r * S.cont - cf;
		g = g * S.cont - cf;
		b = b * S.cont - cf;
		if (S.crush > 0) {
			const crush = (v) =>
				Math.pow(Math.max(0, v / 255), 1 + S.crush * 1.5) * 255;
			r = crush(r);
			g = crush(g);
			b = crush(b);
		}
		if (S.ink > 0) {
			const ic = (v) => {
				const t = Math.max(0, Math.min(1, v / 255));
				const sv =
					t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
				return (t + (sv - t) * S.ink) * 255;
			};
			r = ic(r);
			g = ic(g);
			b = ic(b);
		}
		const lumN = Math.max(
			0,
			Math.min(1, (r * 0.299 + g * 0.587 + b * 0.114) / 255),
		);
		if (S.sStr > 0) {
			const sw = Math.pow(1 - lumN, 2.2) * S.sStr;
			r += (sR - r) * sw;
			g += (sG - g) * sw;
			b += (sB - b) * sw;
		}
		if (S.hStr > 0) {
			const hw = Math.pow(lumN, 2.2) * S.hStr;
			r += (hR - r) * hw;
			g += (hG - g) * hw;
			b += (hB - b) * hw;
		}
		if (S.grain > 0) {
			const n = (rng() - 0.5) * S.grain * 130;
			r += n;
			g += n;
			b += n;
		}
		d[i] = Math.max(0, Math.min(255, r));
		d[i + 1] = Math.max(0, Math.min(255, g));
		d[i + 2] = Math.max(0, Math.min(255, b));
	}
	ctx.putImageData(id, 0, 0);

	if (S.hal > 0.01) {
		const src = ctx.getImageData(0, 0, w, h).data,
			hl = new Uint8ClampedArray(w * h * 4);
		for (let i = 0; i < src.length; i += 4) {
			const l = src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114,
				t = Math.max(0, (l - 175) / 80);
			hl[i] = Math.min(255, src[i] * t * 1.5);
			hl[i + 1] = Math.min(255, src[i + 1] * t * 0.45);
			hl[i + 2] = Math.min(255, src[i + 2] * t * 0.08);
			hl[i + 3] = 255;
		}
		const br = Math.round(Math.max(2, Math.min(w, h) * 0.02 * S.hal * 5)),
			blr = gBlur(hl, w, h, br);
		const base = ctx.getImageData(0, 0, w, h).data,
			out = ctx.createImageData(w, h);
		for (let i = 0; i < base.length; i += 4) {
			const st = S.hal * 0.9;
			out.data[i] = Math.min(
				255,
				base[i] + (blr[i] - (base[i] * blr[i]) / 255) * st,
			);
			out.data[i + 1] = Math.min(
				255,
				base[i + 1] +
				(blr[i + 1] - (base[i + 1] * blr[i + 1]) / 255) * st,
			);
			out.data[i + 2] = Math.min(
				255,
				base[i + 2] +
				(blr[i + 2] - (base[i + 2] * blr[i + 2]) / 255) * st,
			);
			out.data[i + 3] = 255;
		}
		ctx.putImageData(out, 0, 0);
	}

	if (S.bloom > 0.01) {
		const src2 = ctx.getImageData(0, 0, w, h).data,
			bd = new Uint8ClampedArray(w * h * 4);
		for (let i = 0; i < src2.length; i += 4) {
			const l =
				src2[i] * 0.299 + src2[i + 1] * 0.587 + src2[i + 2] * 0.114,
				t = Math.max(0, (l - 155) / 100),
				v = Math.min(255, l * t);
			bd[i] = bd[i + 1] = bd[i + 2] = v;
			bd[i + 3] = 255;
		}
		const br2 = Math.round(
			Math.max(3, Math.min(w, h) * 0.028 * S.bloom * 4),
		),
			blr2 = gBlur(bd, w, h, br2);
		const base2 = ctx.getImageData(0, 0, w, h).data,
			out2 = ctx.createImageData(w, h);
		for (let i = 0; i < base2.length; i += 4) {
			const bv = blr2[i],
				st = S.bloom * 0.72;
			out2.data[i] = Math.min(
				255,
				base2[i] + (bv - (base2[i] * bv) / 255) * st,
			);
			out2.data[i + 1] = Math.min(
				255,
				base2[i + 1] + (bv - (base2[i + 1] * bv) / 255) * st,
			);
			out2.data[i + 2] = Math.min(
				255,
				base2[i + 2] + (bv - (base2[i + 2] * bv) / 255) * st,
			);
			out2.data[i + 3] = 255;
		}
		ctx.putImageData(out2, 0, 0);
	}

	if (S.eBlur > 0.01 || S.eSmear > 0.01) {
		const sharp2 = ctx.getImageData(0, 0, w, h).data;
		const edgeR = Math.round(
			Math.max(
				2,
				Math.min(w, h) * 0.055 * Math.max(S.eBlur, S.eSmear) * 2.8,
			),
		);
		const blurEdge = gBlur(sharp2, w, h, edgeR);
		const out4 = ctx.createImageData(w, h);
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				const xN = (x / w - 0.5) * 2,
					yN = (y / h - 0.5) * 2,
					ef = Math.pow(Math.max(Math.abs(xN), Math.abs(yN)), 2.8);
				const i = (y * w + x) * 4;
				let br = blurEdge[i],
					bg = blurEdge[i + 1],
					bb = blurEdge[i + 2];
				if (S.eSmear > 0.01) {
					const sa = Math.round(S.eSmear * ef * 28);
					if (sa > 0) {
						const ang = Math.atan2(yN, xN);
						let sr2 = 0,
							sg2 = 0,
							sb2 = 0,
							c = 0;
						for (let k = -sa; k <= sa; k++) {
							const sx = Math.min(
								w - 1,
								Math.max(
									0,
									Math.round(x + Math.cos(ang) * k),
								),
							),
								sy = Math.min(
									h - 1,
									Math.max(
										0,
										Math.round(y + Math.sin(ang) * k),
									),
								),
								si = (sy * w + sx) * 4;
							sr2 += sharp2[si];
							sg2 += sharp2[si + 1];
							sb2 += sharp2[si + 2];
							c++;
						}
						br = sr2 / c;
						bg = sg2 / c;
						bb = sb2 / c;
					}
				}
				const t = Math.min(1, ef * Math.max(S.eBlur, S.eSmear) * 1.6);
				out4.data[i] = sharp2[i] * (1 - t) + br * t;
				out4.data[i + 1] = sharp2[i + 1] * (1 - t) + bg * t;
				out4.data[i + 2] = sharp2[i + 2] * (1 - t) + bb * t;
				out4.data[i + 3] = 255;
			}
		ctx.putImageData(out4, 0, 0);
	}

	if (S.scratch > 0.005) {
		ctx.save();
		const rng2 = makePRNG(rngSeed + 1),
			numS = Math.floor(S.scratch * 16 + S.scratch * rng2() * 8);
		for (let k = 0; k < numS; k++) {
			const x = rng2() * w,
				y0 = rng2() * h * 0.4,
				len = rng2() * h * 0.55 + h * 0.15,
				thick = rng2() < 0.7 ? 1 : 1.5;
			ctx.strokeStyle =
				rng2() < 0.5
					? `rgba(210,195,165,${rng2() * 0.35 + 0.08})`
					: `rgba(0,0,0,${rng2() * 0.45 + 0.15})`;
			ctx.lineWidth = thick;
			ctx.beginPath();
			ctx.moveTo(x + rng2() * 6 - 3, y0);
			ctx.lineTo(x + rng2() * 5 - 2.5, y0 + len);
			ctx.stroke();
		}
		ctx.restore();
	}

	if (S.dust > 0.005) {
		ctx.save();
		const rng3 = makePRNG(rngSeed + 2),
			numD = Math.floor(S.dust * 100 + S.dust * rng3() * 60);
		for (let k = 0; k < numD; k++) {
			const x = rng3() * w,
				y = rng3() * h,
				sz = rng3() * 2.2 + 0.3;
			ctx.fillStyle =
				rng3() < 0.38
					? `rgba(220,205,180,${rng3() * 0.45 + 0.08})`
					: `rgba(0,0,0,${rng3() * 0.55 + 0.08})`;
			ctx.beginPath();
			ctx.arc(x, y, sz, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}

	if (S.htone > 0.05) {
		const sp = 6;
		ctx.save();
		ctx.globalCompositeOperation = "multiply";
		ctx.fillStyle = `rgba(0,0,0,${S.htone * 0.92})`;
		for (let y = 0; y < h; y += sp)
			for (let x = 0; x < w; x += sp) {
				const px = ctx.getImageData(x, y, 1, 1).data,
					br = (px[0] + px[1] + px[2]) / 765,
					r2 = (1 - br) * (sp * 0.56) * S.htone;
				if (r2 > 0.25) {
					ctx.beginPath();
					ctx.arc(x, y, r2, 0, Math.PI * 2);
					ctx.fill();
				}
			}
		ctx.restore();
	}

	if (S.vig > 0) {
		const grad = ctx.createRadialGradient(
			w / 2,
			h / 2,
			Math.min(w, h) * 0.22,
			w / 2,
			h / 2,
			Math.max(w, h) * 0.88,
		);
		grad.addColorStop(0, "rgba(0,0,0,0)");
		grad.addColorStop(1, `rgba(0,0,0,${S.vig})`);
		ctx.save();
		ctx.globalCompositeOperation = "multiply";
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
		ctx.restore();
	}

	if (S.grime > 0) {
		const rng4 = makePRNG(rngSeed + 3);
		ctx.save();
		ctx.globalCompositeOperation = "multiply";
		for (let k = 0; k < Math.floor(S.grime * 75); k++) {
			const gx = rng4() * w,
				gy = rng4() * h,
				gr = rng4() * 85 + 8;
			const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
			gg.addColorStop(0, `rgba(0,0,0,${rng4() * S.grime * 0.48})`);
			gg.addColorStop(1, "rgba(0,0,0,0)");
			ctx.fillStyle = gg;
			ctx.beginPath();
			ctx.ellipse(
				gx,
				gy,
				gr * (0.4 + rng4() * 0.7),
				gr * (0.4 + rng4() * 0.7),
				rng4() * Math.PI,
				0,
				Math.PI * 2,
			);
			ctx.fill();
		}
		ctx.restore();
	}
}

function scheduleRender() {
	if (!srcImg) return;
	clearTimeout(renderTimer);
	document.getElementById("status").hidden = false;
	renderTimer = setTimeout(() => {
		doRender();
		document.getElementById("status").hidden = true;
	}, 40);
}

function doRender() {
	if (!srcImg) return;
	const w = srcImg.naturalWidth,
		h = srcImg.naturalHeight;
	fullRes.width = w;
	fullRes.height = h;
	frCtx.drawImage(srcImg, 0, 0);
	applyEffect(frCtx, w, h);
	const wrap = document.getElementById("canvas-wrap");
	const mW = wrap.clientWidth || 800,
		mH = wrap.clientHeight || 600;
	const sc = Math.min(1, mW / w, mH / h);
	const dw = Math.round(w * sc),
		dh = Math.round(h * sc);
	displayCanvas.width = dw;
	displayCanvas.height = dh;
	dCtx.drawImage(fullRes, 0, 0, dw, dh);
}

function buildPresets() {
	["preset-list", "bpreset-list"].forEach((listId, isMobile) => {
		const el = document.getElementById(listId);
		Object.entries(PG).forEach(([group, presets]) => {
			const gl = document.createElement("div");
			gl.className = "pgroup";
			const gLabel = document.createElement("span");
			gLabel.className = "pgroup-label";
			gLabel.textContent = group;
			gl.appendChild(gLabel);
			Object.entries(presets).forEach(([name, preset]) => {
				const button = document.createElement("button");
				button.className =
					"preset-btn" + (name === activePreset ? " active" : "");
				button.innerHTML = `<span class="preset-dot"></span>${name}`;
				button.id = (isMobile ? "m" : "d") + "_p_" + name;
				button.addEventListener("click", () =>
					applyPreset(name, preset),
				);
				gl.appendChild(button);
			});
			el.appendChild(gl);
		});
	});
}

function buildColorPicker(parent, prefix, which, label, initHex, onChange) {
	const cell = document.createElement("div");
	cell.className = "tone-cell";
	cell.innerHTML = `<span class="tone-cell-label">${label}</span>`;
	const wrap = document.createElement("div");
	wrap.className = "color-wrap";
	const sw = document.createElement("div");
	sw.className = "color-swatch";
	sw.style.background = initHex;
	const inp = document.createElement("input");
	inp.type = "color";
	inp.value = initHex;
	inp.id = `${prefix}_${which}Color`;
	const hexSpan = document.createElement("span");
	hexSpan.className = "color-hex";
	hexSpan.textContent = initHex;
	inp.addEventListener("input", (event) => {
		const { value } = event.target;
		onChange(value);
		sw.style.background = value;
		hexSpan.textContent = value;
		document.querySelectorAll(`[id$="_${which}Color"]`).forEach((el) => {
			el.value = value;
			el.parentElement.style.background = value;
		});
	});
	sw.appendChild(inp);
	wrap.appendChild(sw);
	wrap.appendChild(hexSpan);
	cell.appendChild(wrap);
	parent.appendChild(cell);
}

function buildSliders() {
	["slider-list", "bslider-list"].forEach((listId, isMobile) => {
		const el = document.getElementById(listId);
		const prefix = isMobile ? "m" : "d";
		SLIDER_GROUPS.forEach(({ label, sl }) => {
			const sec = document.createElement("div");
			sec.className = "param-section";
			sec.textContent = label;
			el.appendChild(sec);
			if (label === "SPLIT TONE") {
				const tonePair = document.createElement("div");
				tonePair.className = "tone-pair";
				buildColorPicker(
					tonePair,
					prefix,
					"shadow",
					"Shadows",
					shadowHex,
					(value) => {
						shadowHex = value;
						clearActivePreset();
						scheduleRender();
					},
				);
				buildColorPicker(
					tonePair,
					prefix,
					"highlight",
					"Highlights",
					highlightHex,
					(value) => {
						highlightHex = value;
						clearActivePreset();
						scheduleRender();
					},
				);
				el.appendChild(tonePair);
			}
			sl.forEach(({ k, l, mn, mx, st }) => {
				const val = S[k] ?? 0,
					dec = st < 0.01 ? 3 : st < 1 ? 2 : 0;
				const row = document.createElement("div");
				row.className = "slider-row";
				row.innerHTML = `<div class="slider-head"><span class="slider-lbl">${l}</span><span class="slider-val" id="${prefix}v_${k}">${val.toFixed(dec)}</span></div><input type="range" min="${mn}" max="${mx}" step="${st}" value="${val}" id="${prefix}s_${k}">`;
				row.querySelector("input").addEventListener(
					"input",
					(event) => {
						S[k] = parseFloat(event.target.value);
						const disp = S[k].toFixed(dec);
						["d", "m"].forEach((p) => {
							const valueEl = document.getElementById(
								p + "v_" + k,
							),
								sliderEl = document.getElementById(
									p + "s_" + k,
								);
							if (valueEl) valueEl.textContent = disp;
							if (sliderEl) sliderEl.value = S[k];
						});
						clearActivePreset();
						scheduleRender();
					},
				);
				el.appendChild(row);
			});
		});
	});
}

function syncSliders() {
	ALL_SLIDERS.forEach(({ k, st }) => {
		const val = S[k] ?? 0,
			dec = st < 0.01 ? 3 : st < 1 ? 2 : 0,
			disp = val.toFixed(dec);
		["d", "m"].forEach((prefix) => {
			const slider = document.getElementById(prefix + "s_" + k),
				valueEl = document.getElementById(prefix + "v_" + k);
			if (slider) slider.value = val;
			if (valueEl) valueEl.textContent = disp;
		});
	});
	document.querySelectorAll('[id$="_shadowColor"]').forEach((el) => {
		el.value = shadowHex;
		el.parentElement.style.background = shadowHex;
		const hex = el.parentElement.nextSibling;
		if (hex) hex.textContent = shadowHex;
	});
	document.querySelectorAll('[id$="_highlightColor"]').forEach((el) => {
		el.value = highlightHex;
		el.parentElement.style.background = highlightHex;
		const hex = el.parentElement.nextSibling;
		if (hex) hex.textContent = highlightHex;
	});
}

function applyPreset(name, preset) {
	activePreset = name;
	S = { ...preset };
	shadowHex = preset.shadowH || "#120800";
	highlightHex = preset.highlightH || "#c0a870";
	syncSliders();
	document.querySelectorAll(".preset-btn").forEach((button) => {
		const presetName = button.id.replace(/[dm]_p_/, "");
		button.className =
			"preset-btn" + (presetName === name ? " active" : "");
	});
	scheduleRender();
}

function clearActivePreset() {
	activePreset = null;
	document
		.querySelectorAll(".preset-btn")
		.forEach((button) => button.classList.remove("active"));
}

function switchTab(name, button) {
	document
		.querySelectorAll(".atab")
		.forEach((tab) => tab.classList.remove("active"));
	button.classList.add("active");
	document
		.getElementById("panel-presets")
		.classList.toggle("hidden", name !== "presets");
	document
		.getElementById("panel-params")
		.classList.toggle("hidden", name !== "params");
}

function switchBTab(name, button) {
	document
		.querySelectorAll(".btab")
		.forEach((tab) => tab.classList.remove("active"));
	button.classList.add("active");
	document
		.getElementById("panel-bpresets")
		.classList.toggle("hidden", name !== "bpresets");
	document
		.getElementById("panel-bparams")
		.classList.toggle("hidden", name !== "bparams");
}

function loadFile(file) {
	if (!file || !file.type.startsWith("image/")) return;
	randomizeSeed();
	const url = URL.createObjectURL(file);
	const img = new Image();
	img.onload = () => {
		srcImg = img;
		const wrap = document.getElementById("canvas-wrap"),
			mW = wrap.clientWidth || 800,
			mH = wrap.clientHeight || 600;
		const sc = Math.min(1, mW / img.naturalWidth, mH / img.naturalHeight),
			dw = Math.round(img.naturalWidth * sc),
			dh = Math.round(img.naturalHeight * sc);
		origDisplayCanvas.width = dw;
		origDisplayCanvas.height = dh;
		oCtx.drawImage(img, 0, 0, dw, dh);
		document.getElementById("dropZone").style.display = "none";
		origDisplayCanvas.style.display = "none";
		displayCanvas.style.display = "block";
		document.getElementById("origBtn").hidden = false;
		document.getElementById("dlBtn").hidden = false;
		doRender();
		URL.revokeObjectURL(url);
	};
	img.src = url;
}

function showOrig(showOriginal) {
	origDisplayCanvas.style.display = showOriginal ? "block" : "none";
	displayCanvas.style.display = showOriginal ? "none" : "block";
}

function doDownload() {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const link = document.createElement("a");
	link.download = `gothroom-${timestamp}.png`;
	link.href = fullRes.toDataURL("image/png");
	link.click();
}

function bindEvents() {
	document.querySelectorAll("[data-tab-target]").forEach((button) => {
		button.addEventListener("click", () =>
			switchTab(button.dataset.tabTarget, button),
		);
	});

	document.querySelectorAll("[data-btab-target]").forEach((button) => {
		button.addEventListener("click", () =>
			switchBTab(button.dataset.btabTarget, button),
		);
	});

	document
		.getElementById("fileInput")
		.addEventListener("change", (event) => loadFile(event.target.files[0]));

	const dropZone = document.getElementById("dropZone");
	const dropInner = document.getElementById("dropInner");
	dropZone.addEventListener("dragover", (event) => {
		event.preventDefault();
		dropInner.classList.add("over");
	});
	dropZone.addEventListener("dragleave", () =>
		dropInner.classList.remove("over"),
	);
	dropZone.addEventListener("drop", (event) => {
		event.preventDefault();
		dropInner.classList.remove("over");
		loadFile(event.dataTransfer.files[0]);
	});

	const origBtn = document.getElementById("origBtn");
	origBtn.addEventListener("mousedown", () => showOrig(true));
	origBtn.addEventListener("mouseup", () => showOrig(false));
	origBtn.addEventListener("mouseleave", () => showOrig(false));
	origBtn.addEventListener("touchstart", () => showOrig(true), {
		passive: true,
	});
	origBtn.addEventListener("touchend", () => showOrig(false));

	document.getElementById("dlBtn").addEventListener("click", doDownload);

	window.addEventListener("resize", () => {
		if (srcImg) doRender();
	});
}

buildPresets();
buildSliders();
bindEvents();
