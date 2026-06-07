import { useEffect, useState } from 'react';
import { Plus, Search, User, Trash2, Edit2, Image as ImageIcon, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAppStore } from '../stores/useAppStore';
import { personsApi } from '../services/api';
import type { Person } from '../types';

export function Persons() {
  const { persons, setPersons, addToast } = useAppStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Person | null>(null);

  useEffect(() => {
    loadPersons();
  }, []);

  const loadPersons = async () => {
    try {
      setLoading(true);
      const res = await personsApi.list();
      setPersons(res.persons);
    } catch (error) {
      console.error('Failed to load persons:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPersons = persons.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (person: Person) => {
    try {
      await personsApi.delete(person.id);
      setPersons(persons.filter((p) => p.id !== person.id));
      addToast(`已删除人员: ${person.name}`, 'success');
    } catch (error) {
      addToast('删除失败', 'error');
    }
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">目标人员</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mx-auto mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/3 mx-auto"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">目标人员</h1>
          <p className="text-muted-foreground">管理需要美颜的目标人员</p>
        </div>
        <Button onClick={() => setShowAddDrawer(true)}>
          <Plus className="w-4 h-4 mr-2" />
          添加人员
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜索人员..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Persons Grid */}
      {filteredPersons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {search ? '没有找到匹配的人员' : '还没有目标人员'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {search ? '请尝试其他搜索词' : '添加第一个人物开始使用吧'}
            </p>
            {!search && (
              <Button onClick={() => setShowAddDrawer(true)}>
                <Plus className="w-4 h-4 mr-2" />
                添加人员
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPersons.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              onEdit={() => setEditingPerson(person)}
              onDelete={() => setDeleteConfirm(person)}
            />
          ))}
        </div>
      )}

      {/* Add Drawer */}
      {showAddDrawer && (
        <AddPersonDrawer
          onClose={() => setShowAddDrawer(false)}
          onCreated={(person) => {
            addPerson(person);
            setShowAddDrawer(false);
            addToast(`已添加人员: ${person.name}`, 'success');
          }}
        />
      )}

      {/* Edit Drawer */}
      {editingPerson && (
        <EditPersonDrawer
          person={editingPerson}
          onClose={() => setEditingPerson(null)}
          onUpdated={(updated) => {
            setPersons(persons.map((p) => (p.id === updated.id ? updated : p)));
            setEditingPerson(null);
            addToast(`已更新人员: ${updated.name}`, 'success');
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-2">确认删除</h3>
              <p className="text-muted-foreground mb-4">
                确定要删除 <span className="font-medium text-foreground">{deleteConfirm.name}</span> 吗？
                此操作不可撤销。
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  取消
                </Button>
                <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)}>
                  确认删除
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function PersonCard({
  person,
  onEdit,
  onDelete,
}: {
  person: Person;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const avatarUrl = person.avatar_path
    ? `/static/persons/${person.avatar_path.split('/').pop()}`
    : null;

  return (
    <Card className="group hover:shadow-md transition-all">
      <CardContent className="p-6 text-center">
        {/* Avatar */}
        <div className="relative w-20 h-20 mx-auto mb-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={person.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {person.name.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <h3 className="font-semibold text-lg mb-1">{person.name}</h3>
        {person.note && (
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{person.note}</p>
        )}
        <p className="text-xs text-muted-foreground mb-4">
          {person.reference_photos.length} 张参考照片 · 处理 {person.process_count} 次
        </p>

        {/* Actions */}
        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddPersonDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (person: Person) => void;
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
    },
    onDrop: (acceptedFiles) => {
      setPhotos((prev) => [...prev, ...acceptedFiles]);
      acceptedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          setPreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    },
  });

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('请输入姓名');
      return;
    }
    if (photos.length === 0) {
      setError('请至少上传一张参考照片');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const person = await personsApi.create(name, note, photos);
      onCreated(person);
    } catch (error) {
      setError('创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-background shadow-xl animate-fade-in overflow-y-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">添加人员</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <Input
            label="姓名 *"
            placeholder="请输入姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error && !name ? error : undefined}
          />

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">备注</label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="可选备注信息"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              参考照片 *
            </label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? '松开以上传' : '拖拽照片到此处，或点击选择'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">支持 JPG、PNG、WebP 格式</p>
            </div>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {previews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              取消
            </Button>
            <Button className="flex-1" onClick={handleSubmit} loading={loading}>
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditPersonDrawer({
  person,
  onClose,
  onUpdated,
}: {
  person: Person;
  onClose: () => void;
  onUpdated: (person: Person) => void;
}) {
  const [name, setName] = useState(person.name);
  const [note, setNote] = useState(person.note || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const updated = await personsApi.update(person.id, { name, note });
      onUpdated(updated);
    } catch (error) {
      console.error('Failed to update:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-md bg-background shadow-xl animate-fade-in overflow-y-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">编辑人员</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <Input
            label="姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">备注</label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              取消
            </Button>
            <Button className="flex-1" onClick={handleSubmit} loading={loading}>
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
