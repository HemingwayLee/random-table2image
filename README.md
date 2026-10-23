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

## Run with Docker

The Docker image packages `generate.sh` with Node.js and its dependencies, so
other systems can run it without installing anything except Docker.

### Build the image

From the repo root:

```sh
docker build -t random-table2image .
```

### Run it

The image takes the same `<N> <folder> [seed]` arguments as `generate.sh`. The
`folder` is a path *inside* the container, so mount a host folder onto it with
`-v`:

```sh
mkdir -p dataset
docker run --rm \
  -u "$(id -u):$(id -g)" \
  -v "$PWD/dataset:/out" \
  random-table2image 100 /out
```

- `-v "$PWD/dataset:/out"` makes the container's `/out` write into `./dataset`
  on your machine. The host path must be absolute, hence `$PWD`.
- `-u "$(id -u):$(id -g)"` makes the generated files owned by you instead of
  `root`.
- `--rm` deletes the stopped container afterwards (the files stay in `dataset/`).

The container needs no network access at run time, so it also works with
`--network none`.

### Share the image with other machines

Push it to a registry that the other systems can pull from, e.g. Docker Hub:

```sh
docker tag random-table2image <your-user>/random-table2image:1.0
docker push <your-user>/random-table2image:1.0
```

They can then run `<your-user>/random-table2image:1.0` in place of
`random-table2image` in the command above.

### Example: Kubernetes Job

Any system that runs a container image with arguments can use it. For example,
a Kubernetes Job that writes 10,000 pairs to a volume your training job reads:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: generate-table-dataset
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
      containers:
        - name: generate
          image: <your-user>/random-table2image:1.0
          args: ["10000", "/out"]
          volumeMounts:
            - name: dataset
              mountPath: /out
      volumes:
        - name: dataset
          persistentVolumeClaim:
            claimName: lama-dataset   # an existing PVC
```

Each run writes a new random dataset unless you pass a fixed seed (e.g.
`args: ["10000", "/out", "42"]`). Files with the same name from a previous
run are overwritten, so use an empty folder per run.

## Project layout

```
generate.sh               # entry point
Dockerfile                # container image around generate.sh
.dockerignore             # keeps the build context to generate.sh + core/
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
