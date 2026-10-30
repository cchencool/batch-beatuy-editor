"""路径安全校验单元测试"""
import os

from app.core.config import is_safe_path


def test_safe_path_inside_base(tmp_path):
    base = tmp_path / "input"
    base.mkdir()
    target = base / "sub" / "a.jpg"
    assert is_safe_path(str(base), str(target)) is True


def test_safe_path_equal_to_base(tmp_path):
    assert is_safe_path(str(tmp_path), str(tmp_path)) is True


def test_safe_path_outside_base(tmp_path):
    base = tmp_path / "input"
    base.mkdir()
    outside = tmp_path / "secret" / "a.jpg"
    assert is_safe_path(str(base), str(outside)) is False


def test_safe_path_prefix_attack(tmp_path):
    # /tmp/input-evil 不能以字符串前缀冒充 /tmp/input
    base = tmp_path / "input"
    evil = tmp_path / "input-evil" / "a.jpg"
    assert is_safe_path(str(base), str(evil)) is False


def test_safe_path_traversal(tmp_path):
    base = tmp_path / "input"
    base.mkdir()
    traversal = str(base / ".." / ".." / "etc" / "passwd")
    assert is_safe_path(str(base), traversal) is False


def test_safe_path_symlink_escape(tmp_path):
    # 符号链接指向外部时，realpath 后应判定为不安全
    base = tmp_path / "input"
    base.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    link = base / "link"
    os.symlink(str(outside), str(link))
    assert is_safe_path(str(base), str(link / "a.jpg")) is False
