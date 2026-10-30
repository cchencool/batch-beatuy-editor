"""FaceRecognizer.match_person 匹配逻辑单元测试（不加载模型）"""
import numpy as np

from app.core.recognizer import FaceRecognizer


def _emb(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    v = rng.normal(size=512).astype(np.float32)
    return v / np.linalg.norm(v)


def _targets():
    return [
        {"person_id": 1, "person_name": "甲", "embeddings": [_emb(1), _emb(2)]},
        {"person_id": 2, "person_name": "乙", "embeddings": [_emb(3)]},
    ]


def test_match_same_person():
    r = FaceRecognizer(threshold=0.4)
    query = _emb(1)
    person_id, distance = r.match_person(query, _targets())
    assert person_id == 1
    assert distance < 1e-6  # 同一向量距离为0


def test_match_no_target_above_threshold():
    r = FaceRecognizer(threshold=0.4)
    # 构造与所有参考向量都正交的查询向量（距离约为1，大于阈值）
    query = np.ones(512, dtype=np.float32)
    query = query / np.linalg.norm(query)
    person_id, distance = r.match_person(query, _targets())
    assert person_id is None
    assert distance > 0.4


def test_match_picks_closest_within_threshold():
    r = FaceRecognizer(threshold=0.4)
    base = _emb(1)
    # 查询向量偏向人员1
    query = base + 0.01 * _emb(99)
    query = query / np.linalg.norm(query)
    person_id, _ = r.match_person(query, _targets())
    assert person_id == 1


def test_match_empty_targets():
    r = FaceRecognizer(threshold=0.4)
    person_id, distance = r.match_person(_emb(1), [])
    assert person_id is None
    assert distance == float("inf")


def test_custom_threshold_overrides_default():
    r = FaceRecognizer(threshold=0.0)  # 默认阈值极严，匹配不到
    query = _emb(1)
    person_id, _ = r.match_person(query, _targets(), threshold=0.5)
    assert person_id == 1
