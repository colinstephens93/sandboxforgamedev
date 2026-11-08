"""Smoke test: confirms headless Blender works. Renders a small scene to .dev/blender_smoke.png."""
import os
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
cube = bpy.context.active_object
mat = bpy.data.materials.new('paint'); mat.use_nodes = True
mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.9, 0.9, 0.88, 1)
cube.data.materials.append(mat)
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data)
bpy.context.scene.collection.objects.link(cam); cam.location = (3, -3, 2); cam.rotation_euler = (1.1, 0, 0.785)
bpy.context.scene.camera = cam
light_data = bpy.data.lights.new('sun', 'SUN'); light_data.energy = 4
light = bpy.data.objects.new('sun', light_data); bpy.context.scene.collection.objects.link(light); light.rotation_euler = (0.7, 0.2, 0.5)
s = bpy.context.scene
s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = 16
s.render.resolution_x, s.render.resolution_y = 480, 270
os.makedirs('.dev', exist_ok=True)
s.render.filepath = os.path.abspath('.dev/blender_smoke.png')
bpy.ops.render.render(write_still=True)
print('rendered', s.render.filepath)
