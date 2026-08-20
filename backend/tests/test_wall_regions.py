import numpy as np
from app.services.segmentation import RoomSegmentationService
from app.services.wall_regions import WallRegionService


def test_disconnected_walls_become_regions() -> None:
    mask = np.zeros((100, 100), dtype=bool)
    mask[5:35, 5:35] = True
    mask[50:90, 50:90] = True
    walls = WallRegionService(minimum_area=100).extract_walls(mask)
    assert [wall.id for wall in walls] == ["wall-1", "wall-2"]
    assert walls[0].area == 900


def test_clean_wall_mask_respects_protected_pixels() -> None:
    wall = np.ones((8, 8), dtype=bool)
    protected = np.zeros((8, 8), dtype=bool)
    protected[2:6, 2:6] = True
    result = RoomSegmentationService.clean_wall_mask(wall, protected)
    assert not result[3, 3]
    assert result[0, 0]


def test_large_low_confidence_facade_is_kept_by_geometry() -> None:
    wall = np.zeros((100, 100), dtype=bool)
    wall[10:90, 10:90] = True
    regions = WallRegionService(minimum_area=1000, confidence_threshold=0.35).extract_walls(wall, confidence=0.2)
    assert len(regions) == 1


def test_large_exterior_facade_can_split_into_mask_backed_regions() -> None:
    wall = np.zeros((100, 160), dtype=bool)
    wall[10:90, 8:152] = True
    regions = WallRegionService(minimum_area=1000).extract_walls(wall, split_large_regions=True)
    assert len(regions) > 1
    assert all(region.mask for region in regions)
    assert sum(region.area for region in regions) == int(wall.sum())
