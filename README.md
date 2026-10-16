# random-table2image

Generates random synthetic table images, each paired with a random-rectangle
inpainting mask, for training a [LaMa](https://github.com/advimman/lama) model.

## Requirements

- Node.js and npm

The first run installs the Node dependency (`pngjs`) into `core/` automatically.

## Usage

```sh
./generate.sh <N> <folder>
```

| Argument | Description |
| -------- | ----------- |
| `N`      | Number of image + mask pairs to generate (positive integer). |
| `folder` | Output folder. Created if it doesn't exist. |

Example: generate 100 pairs into `dataset/`:

```sh
./generate.sh 100 dataset
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

## Project layout

```
generate.sh               # entry point
core/
├── generate_dataset.js   # writes the N image + mask pairs
├── table_generator.js    # random table layout + rasterization
├── mask_generator.js     # random rectangle masks
├── index.html            # browser preview: Generate / Save a single table
└── package.json
```

`core/index.html` uses the same table algorithm. Open it in a browser to preview
tables one at a time.
