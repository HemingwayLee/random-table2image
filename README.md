# random-table2image

Generates random synthetic table images, each paired with a random-rectangle
inpainting mask, for training a [LaMa](https://github.com/advimman/lama) model.

## Requirements

- Node.js and npm

The first run installs the Node dependency (`pngjs`) into `core/` automatically.

## Usage

```sh
./generate.sh <N> <folder> [seed]
```

| Argument | Description |
| -------- | ----------- |
| `N`      | Number of image + mask pairs to generate (positive integer). |
| `folder` | Output folder. Created if it doesn't exist. |
| `seed`   | Optional non-negative integer. The same `seed` and `N` reproduce exactly the same images and masks. If omitted, a random seed is used; it is printed at the end of the run so you can reproduce it later. |

Example: generate 100 pairs into `dataset/`:

```sh
./generate.sh 100 dataset
```

Same, but reproducible:

```sh
./generate.sh 100 dataset 42
```

If you get `permission denied`, make the script executable first with
`chmod +x generate.sh`, or run it as `bash generate.sh 100 dataset`.

## Output

```
dataset/
├── table_00000.png           # table image
├── table_00000_mask001.png   # its mask
├── table_00001.png
├── table_00001_mask001.png
└── ...
```

- **Image:** a random table (rows, columns, merged cells, borders, colored or
  patterned cells) on a white margin.
- **Mask:** same size as its image; black background with 2–5 separate white
  rectangles. White marks the region LaMa should inpaint.

The `<name>_mask001.png` naming is what LaMa uses to pair masks with images, so
the folder can be used directly as a LaMa `val/` or `visual_test/` set.
LaMa's default `train/` loader instead reads only `*.jpg` images and creates
masks on the fly, so it won't pick up these PNGs.

Files with the same name from a previous run are overwritten, so use an empty
folder per run.

## Web app (Docker Compose)

A small web UI around `generate.sh`: pick N and an optional seed, watch the
run's progress, browse the image + mask pairs, and download them as a zip.
FastAPI backend and React + MUI + Vite frontend, both hot reloading.

```sh
docker compose -f docker-compose.dev.yml up --build
```

| Service  | URL                        |
| -------- | -------------------------- |
| UI       | http://localhost:5679      |
| API      | http://localhost:8766/api  |
| API docs | http://localhost:8766/docs |

- Each run executes `generate.sh <N> /output/<run id> [seed]` in the backend
  container, so the files land in `./output/<run id>/` on your machine, named
  exactly as above. Run records (status, seed, log) are in `./output/.runs/`.
- Without a seed, the random seed `generate.sh` picks is read from its output
  and shown on the run, so any run can be reproduced.
- At most `MAX_CONCURRENT_RUNS` (default 2) runs generate at once; the rest
  wait. N is capped at `MAX_COUNT` (default 100000). Set either in the shell
  or a `.env` file.
- Cancel stops the run (its pairs so far are kept). Delete removes its folder.
- A backend restart or reload stops running runs; they are marked as errors.
- API: `POST /api/runs` (`{"count": 100, "seed": 42}`), `GET /api/runs`,
  `GET /api/runs/{id}`, `POST /api/runs/{id}/cancel`, `DELETE /api/runs/{id}`,
  `GET /api/runs/{id}/pairs`, `GET /api/runs/{id}/files/{name}`,
  `GET /api/runs/{id}/zip`.

Hot reload: edits under `frontend/src` (Vite HMR) and `backend/app` (uvicorn
`--reload`) apply at once. `generate.sh` and `core/` are mounted into the
backend, and every run starts a fresh process, so edits there apply to the
next run. After changing dependencies (`package.json`, `requirements.txt` or
`core/package.json`), rebuild with fresh `node_modules` volumes:

```sh
docker compose -f docker-compose.dev.yml up --build -V
```

## Project layout

```
generate.sh               # entry point
docker-compose.dev.yml    # web app: backend + frontend, hot reloading
backend/app/              # FastAPI: runs generate.sh, serves the results
frontend/src/             # React + MUI UI
output/                   # web app runs (git-ignored)
core/
├── generate_dataset.js   # writes the N image + mask pairs
├── table_generator.js    # random table layout + rasterization
├── mask_generator.js     # random rectangle masks
├── index.html            # browser preview: Generate / Save image + mask pairs
└── package.json
```

`core/index.html` loads `core/table_generator.js` and `core/mask_generator.js`,
the same code `generate.sh` uses, so there is only one copy of the algorithm.
Open it in a browser to preview image + mask pairs one at a time.

Seeds behave the same in both: images and masks within one run are all
different, and the same seed always gives the same sequence. On the page, enter
a seed (or leave it empty and a random one is filled in), then each Generate
click shows the next pair, so the k-th click equals `table_<k-1>.png` and its
mask from `generate.sh <N> <folder> <seed>`. Editing the seed restarts the
sequence. Save downloads the current pair under the same file names.
