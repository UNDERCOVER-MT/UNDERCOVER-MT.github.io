# %%
import os

from trame.app import get_server
from trame.ui.vuetify import SinglePageWithDrawerLayout
from trame.widgets import vtk, vuetify, trame

from vtkmodules.vtkCommonDataModel import vtkDataObject, vtkPlane
from vtkmodules.vtkFiltersCore import vtkContourFilter, vtkCutter
from vtkmodules.vtkRenderingAnnotation import (
    vtkCubeAxesActor,
    vtkAxesActor,
    vtkScalarBarActor,
)
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkDataSetMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)
from vtkmodules.vtkIOLegacy import vtkRectilinearGridReader, vtkUnstructuredGridReader

# Required for interactor initialization
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa

# Required for rendering initialization, not necessary for local rendering,
# but doesn't hurt to include it.
import vtkmodules.vtkRenderingOpenGL2  # noqa

from vtkmodules.vtkCommonColor import vtkNamedColors

CURRENT_DIRECTORY = os.path.abspath(os.path.dirname(__file__))

# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------
colors = vtkNamedColors()


class Representation:
    Points = 0
    Wireframe = 1
    Surface = 2
    SurfaceWithEdges = 3


class LookupTable:
    Rainbow = 0
    Inverted_Rainbow = 1
    Greyscale = 2
    Inverted_Greyscale = 3


# -----------------------------------------------------------------------------
# VTK pipeline
# -----------------------------------------------------------------------------
renderer = vtkRenderer()
renderWindow = vtkRenderWindow()
renderWindow.AddRenderer(renderer)

renderWindowInteractor = vtkRenderWindowInteractor()
renderWindowInteractor.SetRenderWindow(renderWindow)
renderWindowInteractor.GetInteractorStyle().SetCurrentStyleToTrackballCamera()

# -----------------------------------------------------------------------------
# Read the data (ONLY one file: ./data/model.vtk) - RECTILINEAR_GRID legacy VTK
# -----------------------------------------------------------------------------
reader = vtkRectilinearGridReader()
model_path = os.path.join(CURRENT_DIRECTORY, "result.vtk")
if not os.path.exists(model_path):
    raise FileNotFoundError(
        f"Could not find model VTK file at: {model_path}\n"
        "Please put your file there and name it exactly: result.vtk"
    )

reader.SetFileName(model_path)
reader.Update()

data = reader.GetOutput()
bounds = data.GetBounds()  # (xmin, xmax, ymin, ymax, zmin, zmax)
xmin, xmax, ymin, ymax, zmin, zmax = bounds

cx = 0.5 * (xmin + xmax)
cy = 0.5 * (ymin + ymax)
cz = 0.5 * (zmin + zmax)

dx = xmax - xmin
dy = ymax - ymin
dz = zmax - zmin
R = max(dx, dy, dz)  # model size scale
# -----------------------------------------------------------------------------
# Extract Array/Field information
# -----------------------------------------------------------------------------
dataset_arrays = []
fields = [
    (data.GetPointData(), vtkDataObject.FIELD_ASSOCIATION_POINTS),
    (data.GetCellData(), vtkDataObject.FIELD_ASSOCIATION_CELLS),
]
for field_arrays, association in fields:
    for i in range(field_arrays.GetNumberOfArrays()):
        array = field_arrays.GetArray(i)
        if array is None or array.GetName() is None:
            continue
        array_range = array.GetRange()
        dataset_arrays.append(
            {
                "text": array.GetName(),
                "value": len(dataset_arrays),
                "range": list(array_range),
                "type": association,
            }
        )

if not dataset_arrays:
    # If the dataset has no arrays, create a dummy entry so UI won't crash.
    dataset_arrays = [
        {
            "text": "(none)",
            "value": 0,
            "range": [0.0, 1.0],
            "type": vtkDataObject.FIELD_ASSOCIATION_CELLS,
        }
    ]

default_array = dataset_arrays[0]
default_min, default_max = default_array.get("range")

# -----------------------------------------------------------------------------
# Mesh
# -----------------------------------------------------------------------------
mesh_mapper = vtkDataSetMapper()
mesh_mapper.SetInputConnection(reader.GetOutputPort())
mesh_actor = vtkActor()
mesh_actor.SetMapper(mesh_mapper)
renderer.AddActor(mesh_actor)

mesh_actor.GetProperty().SetRepresentationToSurface()
mesh_actor.GetProperty().SetPointSize(1)
mesh_actor.GetProperty().EdgeVisibilityOn()

# Mesh lookup table (default rainbow)
mesh_lut = mesh_mapper.GetLookupTable()
mesh_lut.SetHueRange(0.666, 0.0)
mesh_lut.SetSaturationRange(1.0, 1.0)
mesh_lut.SetValueRange(1, 1.0)
mesh_lut.Build()

# Mesh: color by default array
mesh_mapper.SelectColorArray(default_array.get("text"))
mesh_mapper.GetLookupTable().SetRange(default_min, default_max)
if default_array.get("type") == vtkDataObject.FIELD_ASSOCIATION_POINTS:
    mesh_mapper.SetScalarModeToUsePointFieldData()
else:
    mesh_mapper.SetScalarModeToUseCellFieldData()
mesh_mapper.SetScalarVisibility(True)
mesh_mapper.SetUseLookupTableScalarRange(False)


# -----------------------------------------------------------------------------
# Slices (3 cutters: Z, X, Y)
# -----------------------------------------------------------------------------
def make_slice(normal, origin):
    plane = vtkPlane()
    plane.SetNormal(*normal)
    plane.SetOrigin(*origin)

    cutter = vtkCutter()
    cutter.SetCutFunction(plane)
    cutter.SetInputConnection(reader.GetOutputPort())
    cutter.Update()

    mapper = vtkDataSetMapper()
    mapper.SetInputConnection(cutter.GetOutputPort())
    mapper.SetLookupTable(mesh_mapper.GetLookupTable())  # share LUT

    actor = vtkActor()
    actor.SetMapper(mapper)
    renderer.AddActor(actor)

    # Color settings
    mapper.SelectColorArray(default_array.get("text"))
    if default_array.get("type") == vtkDataObject.FIELD_ASSOCIATION_POINTS:
        mapper.SetScalarModeToUsePointFieldData()
    else:
        mapper.SetScalarModeToUseCellFieldData()
    mapper.SetScalarVisibility(True)
    mapper.SetUseLookupTableScalarRange(False)
    mapper.GetLookupTable().SetRange(default_min, default_max)

    actor.GetProperty().SetRepresentationToSurface()
    actor.GetProperty().EdgeVisibilityOff()
    return plane, cutter, mapper, actor


# Default slice positions: mid of bounds
x0 = 0.5 * (xmin + xmax)
y0 = 0.5 * (ymin + ymax)
z0 = 0.5 * (zmin + zmax)

z_plane, z_cutter, z_mapper, z_actor = make_slice((0, 0, 1), (0, 0, z0))
x_plane, x_cutter, x_mapper, x_actor = make_slice((1, 0, 0), (x0, 0, 0))
y_plane, y_cutter, y_mapper, y_actor = make_slice((0, 1, 0), (0, y0, 0))

# Make slices slightly transparent by default
z_actor.GetProperty().SetOpacity(0.9)
x_actor.GetProperty().SetOpacity(0.9)
y_actor.GetProperty().SetOpacity(0.9)

# -----------------------------------------------------------------------------
# Contour (optional)
# -----------------------------------------------------------------------------
contour = vtkContourFilter()
contour.SetInputConnection(reader.GetOutputPort())
contour_mapper = vtkDataSetMapper()
contour_mapper.SetInputConnection(contour.GetOutputPort())
contour_mapper.SetLookupTable(mesh_mapper.GetLookupTable())
contour_actor = vtkActor()
contour_actor.SetMapper(contour_mapper)
renderer.AddActor(contour_actor)

contour_value = 0.5 * (default_max + default_min)
contour.SetInputArrayToProcess(
    0, 0, 0, default_array.get("type"), default_array.get("text")
)
contour.SetValue(0, contour_value)

contour_actor.GetProperty().SetRepresentationToSurface()
contour_actor.GetProperty().EdgeVisibilityOff()

contour_mapper.SelectColorArray(default_array.get("text"))
contour_mapper.GetLookupTable().SetRange(default_min, default_max)
if default_array.get("type") == vtkDataObject.FIELD_ASSOCIATION_POINTS:
    contour_mapper.SetScalarModeToUsePointFieldData()
else:
    contour_mapper.SetScalarModeToUseCellFieldData()
contour_mapper.SetScalarVisibility(True)
contour_mapper.SetUseLookupTableScalarRange(True)

# -----------------------------------------------------------------------------
# Axes, Cube axes, Scalar bar
# -----------------------------------------------------------------------------
cube_axes = vtkCubeAxesActor()
renderer.AddActor(cube_axes)

cube_axes.SetBounds(mesh_actor.GetBounds())
cube_axes.SetCamera(renderer.GetActiveCamera())
cube_axes.SetXLabelFormat("%6.1f")
cube_axes.SetYLabelFormat("%6.1f")
cube_axes.SetZLabelFormat("%6.1f")
cube_axes.SetFlyModeToOuterEdges()

scalar_bar = vtkScalarBarActor()
scalar_bar.SetLookupTable(mesh_mapper.GetLookupTable())
scalar_bar.SetTitle(default_array.get("text"))
scalar_bar.UnconstrainedFontSizeOff()
scalar_bar.SetNumberOfLabels(8)
scalar_bar.SetVerticalTitleSeparation(10)
scalar_bar.SetBarRatio(scalar_bar.GetBarRatio() * 0.5)
scalar_bar.SetPosition(0.87, 0.1)
renderer.AddActor(scalar_bar)

axes = vtkAxesActor()
axes.SetXAxisLabelText("X")
axes.SetYAxisLabelText("Y")
axes.SetZAxisLabelText("Z")
renderer.AddActor(axes)

renderer.SetBackground(0.2, 0.4, 0.6)
renderer.ResetCamera()

camera = renderer.GetActiveCamera()
camera.SetFocalPoint(cx, cy, cz)

# Pick an initial position relative to model size
# (keeps UTM coords, just sets where the camera sits)
camera.SetPosition(cx, cy - 2.5 * R, cz + 1.2 * R)
camera.SetViewUp(0, 0, 1)

renderer.ResetCameraClippingRange()
# -----------------------------------------------------------------------------
# GUI and Trame setup
# -----------------------------------------------------------------------------
server = get_server(client_type="vue2")
state, ctrl = server.state, server.controller
state.setdefault("active_ui", None)


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def update_representation(actor, mode):
    prop = actor.GetProperty()
    if mode == Representation.Points:
        prop.SetRepresentationToPoints()
        prop.SetPointSize(5)
        prop.EdgeVisibilityOff()
    elif mode == Representation.Wireframe:
        prop.SetRepresentationToWireframe()
        prop.SetPointSize(1)
        prop.EdgeVisibilityOff()
    elif mode == Representation.Surface:
        prop.SetRepresentationToSurface()
        prop.SetPointSize(1)
        prop.EdgeVisibilityOff()
    elif mode == Representation.SurfaceWithEdges:
        prop.SetRepresentationToSurface()
        prop.SetPointSize(1)
        prop.EdgeVisibilityOn()


def color_by_array(actor, array):
    _min, _max = array.get("range")
    mapper = actor.GetMapper()
    mapper.SelectColorArray(array.get("text"))
    mapper.GetLookupTable().SetRange(_min, _max)
    if array.get("type") == vtkDataObject.FIELD_ASSOCIATION_POINTS:
        mapper.SetScalarModeToUsePointFieldData()
    else:
        mapper.SetScalarModeToUseCellFieldData()
    mapper.SetScalarVisibility(True)
    mapper.SetUseLookupTableScalarRange(False)
    # Keep scalar bar title aligned with current mesh selection
    scalar_bar.SetTitle(array.get("text"))


def use_preset(actor, preset):
    lut = actor.GetMapper().GetLookupTable()
    if preset == LookupTable.Rainbow:
        lut.SetHueRange(0.666, 0.0)
        lut.SetSaturationRange(1.0, 1.0)
        lut.SetValueRange(1.0, 1.0)
    elif preset == LookupTable.Inverted_Rainbow:
        lut.SetHueRange(0.0, 0.666)
        lut.SetSaturationRange(1.0, 1.0)
        lut.SetValueRange(1.0, 1.0)
    elif preset == LookupTable.Greyscale:
        lut.SetHueRange(0.0, 0.0)
        lut.SetSaturationRange(0.0, 0.0)
        lut.SetValueRange(0.0, 1.0)
    elif preset == LookupTable.Inverted_Greyscale:
        lut.SetHueRange(0.0, 0.666)
        lut.SetSaturationRange(0.0, 0.0)
        lut.SetValueRange(1.0, 0.0)
    lut.Build()


# -----------------------------------------------------------------------------
# Callbacks
# -----------------------------------------------------------------------------
@state.change("cube_axes_visibility")
def update_cube_axes_visibility(cube_axes_visibility, **kwargs):
    cube_axes.SetVisibility(cube_axes_visibility)
    ctrl.view_update()


def actives_change(ids):
    _id = ids[0]
    if _id == "1":
        state.active_ui = "mesh"
    elif _id == "2":
        state.active_ui = "contour"
    elif _id == "3":
        state.active_ui = "slice_z"
    elif _id == "4":
        state.active_ui = "slice_x"
    elif _id == "5":
        state.active_ui = "slice_y"
    else:
        state.active_ui = "nothing"


def visibility_change(event):
    _id = event["id"]
    _visibility = event["visible"]

    if _id == "1":
        mesh_actor.SetVisibility(_visibility)
    elif _id == "2":
        contour_actor.SetVisibility(_visibility)
    elif _id == "3":
        z_actor.SetVisibility(_visibility)
    elif _id == "4":
        x_actor.SetVisibility(_visibility)
    elif _id == "5":
        y_actor.SetVisibility(_visibility)
    ctrl.view_update()


# Representation
@state.change("mesh_representation")
def _mesh_rep(mesh_representation, **kwargs):
    update_representation(mesh_actor, mesh_representation)
    ctrl.view_update()


@state.change("slice_z_representation")
def _z_rep(slice_z_representation, **kwargs):
    update_representation(z_actor, slice_z_representation)
    ctrl.view_update()


@state.change("slice_x_representation")
def _x_rep(slice_x_representation, **kwargs):
    update_representation(x_actor, slice_x_representation)
    ctrl.view_update()


@state.change("slice_y_representation")
def _y_rep(slice_y_representation, **kwargs):
    update_representation(y_actor, slice_y_representation)
    ctrl.view_update()


@state.change("contour_representation")
def _cont_rep(contour_representation, **kwargs):
    update_representation(contour_actor, contour_representation)
    ctrl.view_update()


# Color by (mesh + slices + contour share same options)
@state.change("mesh_color_array_idx")
def _mesh_color(mesh_color_array_idx, **kwargs):
    array = dataset_arrays[mesh_color_array_idx]
    # Apply to mesh + slices + contour for consistency
    for a in (mesh_actor, z_actor, x_actor, y_actor, contour_actor):
        color_by_array(a, array)
    ctrl.view_update()


# Colormap preset (mesh lut is shared, so one change affects everything)
@state.change("mesh_color_preset")
def _mesh_preset(mesh_color_preset, **kwargs):
    use_preset(mesh_actor, mesh_color_preset)
    ctrl.view_update()


# Opacity
@state.change("mesh_opacity")
def _mesh_op(mesh_opacity, **kwargs):
    mesh_actor.GetProperty().SetOpacity(mesh_opacity)
    ctrl.view_update()


@state.change("slice_z_opacity")
def _z_op(slice_z_opacity, **kwargs):
    z_actor.GetProperty().SetOpacity(slice_z_opacity)
    ctrl.view_update()


@state.change("slice_x_opacity")
def _x_op(slice_x_opacity, **kwargs):
    x_actor.GetProperty().SetOpacity(slice_x_opacity)
    ctrl.view_update()


@state.change("slice_y_opacity")
def _y_op(slice_y_opacity, **kwargs):
    y_actor.GetProperty().SetOpacity(slice_y_opacity)
    ctrl.view_update()


@state.change("contour_opacity")
def _cont_op(contour_opacity, **kwargs):
    contour_actor.GetProperty().SetOpacity(contour_opacity)
    ctrl.view_update()


# Slice positions (world coordinates)
@state.change("slice_z")
def _z_pos(slice_z, **kwargs):
    z_plane.SetOrigin(0, 0, float(slice_z))
    ctrl.view_update()


@state.change("slice_x")
def _x_pos(slice_x, **kwargs):
    x_plane.SetOrigin(float(slice_x), 0, 0)
    ctrl.view_update()


@state.change("slice_y")
def _y_pos(slice_y, **kwargs):
    y_plane.SetOrigin(0, float(slice_y), 0)
    ctrl.view_update()


# Contour value
@state.change("contour_by_array_idx")
def update_contour_by(contour_by_array_idx, **kwargs):
    array = dataset_arrays[contour_by_array_idx]
    contour_min, contour_max = array.get("range")
    contour_step = max(1e-9, 0.01 * (contour_max - contour_min))
    contour_value = 0.5 * (contour_max + contour_min)
    contour.SetInputArrayToProcess(0, 0, 0, array.get("type"), array.get("text"))
    contour.SetValue(0, float(contour_value))

    state.contour_min = contour_min
    state.contour_max = contour_max
    state.contour_value = contour_value
    state.contour_step = contour_step
    ctrl.view_update()


@state.change("contour_value")
def update_contour_value(contour_value, **kwargs):
    contour.SetValue(0, float(contour_value))
    ctrl.view_update()


# -----------------------------------------------------------------------------
# GUI elements
# -----------------------------------------------------------------------------
def standard_buttons():
    vuetify.VCheckbox(
        v_model=("cube_axes_visibility", True),
        on_icon="mdi-cube-outline",
        off_icon="mdi-cube-off-outline",
        classes="mx-1",
        hide_details=True,
        dense=True,
    )
    vuetify.VCheckbox(
        v_model="$vuetify.theme.dark",
        on_icon="mdi-lightbulb-off-outline",
        off_icon="mdi-lightbulb-outline",
        classes="mx-1",
        hide_details=True,
        dense=True,
    )
    with vuetify.VBtn(icon=True, click="$refs.view.resetCamera()"):
        vuetify.VIcon("mdi-crop-free")


def pipeline_widget():
    trame.GitTree(
        sources=(
            "pipeline",
            [
                {"id": "1", "parent": "0", "visible": 1, "name": "Mesh"},
                {"id": "2", "parent": "1", "visible": 0, "name": "Contour"},
                {"id": "3", "parent": "1", "visible": 1, "name": "Slice Z"},
                {"id": "4", "parent": "1", "visible": 1, "name": "Slice X"},
                {"id": "5", "parent": "1", "visible": 1, "name": "Slice Y"},
            ],
        ),
        actives_change=(actives_change, "[$event]"),
        visibility_change=(visibility_change, "[$event]"),
    )


def ui_card(title, ui_name):
    with vuetify.VCard(v_show=f"active_ui == '{ui_name}'"):
        vuetify.VCardTitle(
            title,
            classes="grey lighten-1 py-1 grey--text text--darken-3",
            style="user-select: none; cursor: pointer",
            hide_details=True,
            dense=True,
        )
        content = vuetify.VCardText(classes="py-2")
    return content


def common_representation_select(
    v_model_name, default_value=Representation.SurfaceWithEdges
):
    vuetify.VSelect(
        v_model=(v_model_name, default_value),
        items=(
            "representations",
            [
                {"text": "Points", "value": 0},
                {"text": "Wireframe", "value": 1},
                {"text": "Surface", "value": 2},
                {"text": "SurfaceWithEdges", "value": 3},
            ],
        ),
        label="Representation",
        hide_details=True,
        dense=True,
        outlined=True,
        classes="pt-1",
    )


def mesh_card():
    with ui_card(title="Mesh", ui_name="mesh"):
        common_representation_select("mesh_representation", Representation.Surface)

        with vuetify.VRow(classes="pt-2", dense=True):
            with vuetify.VCol(cols="6"):
                vuetify.VSelect(
                    label="Color by",
                    v_model=("mesh_color_array_idx", 0),
                    items=("array_list", dataset_arrays),
                    hide_details=True,
                    dense=True,
                    outlined=True,
                    classes="pt-1",
                )
            with vuetify.VCol(cols="6"):
                vuetify.VSelect(
                    label="Colormap",
                    v_model=("mesh_color_preset", LookupTable.Rainbow),
                    items=(
                        "colormaps",
                        [
                            {"text": "Rainbow", "value": 0},
                            {"text": "Inv Rainbow", "value": 1},
                            {"text": "Greyscale", "value": 2},
                            {"text": "Inv Greyscale", "value": 3},
                        ],
                    ),
                    hide_details=True,
                    dense=True,
                    outlined=True,
                    classes="pt-1",
                )

        vuetify.VSlider(
            v_model=("mesh_opacity", 1.0),
            min=0,
            max=1,
            step=0.05,
            label="Opacity",
            classes="mt-1",
            hide_details=True,
            dense=True,
            thumb_label=True,
        )


def contour_card():
    with ui_card(title="Contour", ui_name="contour"):
        vuetify.VSelect(
            label="Contour by",
            v_model=("contour_by_array_idx", 0),
            items=("array_list", dataset_arrays),
            hide_details=True,
            dense=True,
            outlined=True,
            classes="pt-1",
        )

        vuetify.VSlider(
            v_model=("contour_value", contour_value),
            min=("contour_min", default_min),
            max=("contour_max", default_max),
            step=("contour_step", max(1e-9, 0.01 * (default_max - default_min))),
            label="Value",
            classes="my-1",
            thumb_label=True,
            hide_details=True,
            dense=True,
        )

        common_representation_select("contour_representation", Representation.Surface)

        vuetify.VSlider(
            v_model=("contour_opacity", 1.0),
            min=0,
            max=1,
            step=0.05,
            label="Opacity",
            classes="mt-1",
            hide_details=True,
            dense=True,
            thumb_label=True,
        )


def slice_card(
    title,
    ui_name,
    slice_axis,
    slider_model,
    slider_min,
    slider_max,
    rep_model,
    op_model,
    min_btn_click,
    mid_btn_click,
    max_btn_click,
):
    with ui_card(title=title, ui_name=ui_name):
        common_representation_select(rep_model, Representation.SurfaceWithEdges)

        with vuetify.VRow(dense=True, classes="pt-1"):
            with vuetify.VCol(cols="4"):
                vuetify.VBtn("Min", small=True, block=True, click=min_btn_click)
            with vuetify.VCol(cols="4"):
                vuetify.VBtn("Mid", small=True, block=True, click=mid_btn_click)
            with vuetify.VCol(cols="4"):
                vuetify.VBtn("Max", small=True, block=True, click=max_btn_click)

        vuetify.VSlider(
            v_model=(slider_model, 0.5 * (slider_min + slider_max)),
            min=slider_min,
            max=slider_max,
            step=(slider_max - slider_min) / 200.0 if slider_max > slider_min else 1.0,
            label=f"{slice_axis} position",
            classes="mt-1",
            hide_details=True,
            dense=True,
            thumb_label=True,
        )

        vuetify.VSlider(
            v_model=(op_model, 0.9),
            min=0,
            max=1,
            step=0.05,
            label="Opacity",
            classes="mt-1",
            hide_details=True,
            dense=True,
            thumb_label=True,
        )


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------
with SinglePageWithDrawerLayout(server) as layout:
    layout.title.set_text("Model Viewer")

    with layout.toolbar:
        vuetify.VSpacer()
        vuetify.VDivider(vertical=True, classes="mx-2")
        standard_buttons()

    with layout.drawer as drawer:
        drawer.width = 340
        pipeline_widget()
        vuetify.VDivider(classes="mb-2")
        mesh_card()
        contour_card()

        # Slices with quick buttons (min/mid/max)
        slice_card(
            title="Slice Z",
            ui_name="slice_z",
            slice_axis="Z",
            slider_model="slice_z",
            slider_min=zmin,
            slider_max=zmax,
            rep_model="slice_z_representation",
            op_model="slice_z_opacity",
            min_btn_click=f"slice_z={zmin}",
            mid_btn_click=f"slice_z={(0.5*(zmin+zmax))}",
            max_btn_click=f"slice_z={zmax}",
        )
        slice_card(
            title="Slice X",
            ui_name="slice_x",
            slice_axis="X",
            slider_model="slice_x",
            slider_min=xmin,
            slider_max=xmax,
            rep_model="slice_x_representation",
            op_model="slice_x_opacity",
            min_btn_click=f"slice_x={xmin}",
            mid_btn_click=f"slice_x={(0.5*(xmin+xmax))}",
            max_btn_click=f"slice_x={xmax}",
        )
        slice_card(
            title="Slice Y",
            ui_name="slice_y",
            slice_axis="Y",
            slider_model="slice_y",
            slider_min=ymin,
            slider_max=ymax,
            rep_model="slice_y_representation",
            op_model="slice_y_opacity",
            min_btn_click=f"slice_y={ymin}",
            mid_btn_click=f"slice_y={(0.5*(ymin+ymax))}",
            max_btn_click=f"slice_y={ymax}",
        )

    with layout.content:
        with vuetify.VContainer(fluid=True, classes="pa-0 fill-height"):
            view = vtk.VtkLocalView(renderWindow)
            ctrl.view_update = view.update
            ctrl.view_reset_camera = view.reset_camera

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    server.start()
