import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { 
  Trash2, 
  Edit3, 
  Star, 
  StarOff, 
  Move, 
  Eye, 
  Download,
  MoreVertical 
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProductImage {
  id: string;
  image_url: string;
  alt_text?: string;
  display_order: number;
  is_primary: boolean;
  file_size?: number;
  width?: number;
  height?: number;
  format?: string;
}

interface ImageGalleryProps {
  productId: string;
  images: ProductImage[];
  onImagesChange: (images: ProductImage[]) => void;
  canEdit?: boolean;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  productId,
  images,
  onImagesChange,
  canEdit = false,
}) => {
  const [localImages, setLocalImages] = useState<ProductImage[]>(images);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocalImages(images);
  }, [images]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !canEdit) return;

    const items = Array.from(localImages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update display_order
    const updatedImages = items.map((item, index) => ({
      ...item,
      display_order: index,
    }));

    setLocalImages(updatedImages);
    onImagesChange(updatedImages);

    // Update in database
    try {
      for (const image of updatedImages) {
        await supabase
          .from('product_images')
          .update({ display_order: image.display_order })
          .eq('id', image.id);
      }
    } catch (error) {
      console.error('Failed to update image order:', error);
    }
  };

  const setPrimaryImage = async (imageId: string) => {
    if (!canEdit) return;

    setLoading(true);
    try {
      // Remove primary flag from all images
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId);

      // Set new primary image
      await supabase
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      // Update local state
      const updatedImages = localImages.map(img => ({
        ...img,
        is_primary: img.id === imageId,
      }));

      setLocalImages(updatedImages);
      onImagesChange(updatedImages);
    } catch (error) {
      console.error('Failed to set primary image:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteImage = async (imageId: string) => {
    if (!canEdit) return;

    const imageToDelete = localImages.find(img => img.id === imageId);
    if (!imageToDelete) return;

    if (!confirm('Are you sure you want to delete this image?')) return;

    setLoading(true);
    try {
      // Delete from storage
      const path = imageToDelete.image_url.split('/').pop();
      if (path) {
        await supabase.storage
          .from('product-images')
          .remove([path]);
      }

      // Delete from database
      await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId);

      // Update local state
      const updatedImages = localImages.filter(img => img.id !== imageId);
      setLocalImages(updatedImages);
      onImagesChange(updatedImages);
    } catch (error) {
      console.error('Failed to delete image:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAltText = async (imageId: string) => {
    if (!canEdit) return;

    setLoading(true);
    try {
      await supabase
        .from('product_images')
        .update({ alt_text: altText })
        .eq('id', imageId);

      // Update local state
      const updatedImages = localImages.map(img =>
        img.id === imageId ? { ...img, alt_text: altText } : img
      );

      setLocalImages(updatedImages);
      onImagesChange(updatedImages);
      setEditingImage(null);
      setAltText('');
    } catch (error) {
      console.error('Failed to update alt text:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (localImages.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            <Eye className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">No Images</h3>
            <p className="text-gray-600">Upload some images to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Primary Image Display */}
      {localImages.find(img => img.is_primary) && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <Star className="w-4 h-4 text-yellow-500 mr-2" />
              Primary Image
            </h3>
          </div>
          <div className="p-4">
            {(() => {
              const primaryImage = localImages.find(img => img.is_primary)!;
              return (
                <div className="flex items-start space-x-4">
                  <img
                    src={primaryImage.image_url}
                    alt={primaryImage.alt_text || 'Primary product image'}
                    className="w-32 h-32 object-cover rounded-lg border"
                  />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-gray-600">
                      {primaryImage.width && primaryImage.height && (
                        <span>{primaryImage.width} × {primaryImage.height}px • </span>
                      )}
                      {formatFileSize(primaryImage.file_size)}
                      {primaryImage.format && (
                        <span> • {primaryImage.format.toUpperCase()}</span>
                      )}
                    </p>
                    {primaryImage.alt_text && (
                      <p className="text-sm text-gray-800">
                        <strong>Alt text:</strong> {primaryImage.alt_text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Image Grid */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="images" direction="horizontal">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {localImages.map((image, index) => (
                <Draggable
                  key={image.id}
                  draggableId={image.id}
                  index={index}
                  isDragDisabled={!canEdit}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`
                        relative group bg-white rounded-lg border-2 overflow-hidden transition-all duration-200
                        ${snapshot.isDragging
                          ? 'border-primary-500 shadow-lg scale-105'
                          : 'border-gray-200 hover:border-gray-300'
                        }
                        ${image.is_primary ? 'ring-2 ring-yellow-400' : ''}
                      `}
                    >
                      {/* Drag Handle */}
                      {canEdit && (
                        <div
                          {...provided.dragHandleProps}
                          className="absolute top-2 left-2 z-10 w-6 h-6 bg-black bg-opacity-50 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-move"
                        >
                          <Move className="w-3 h-3 text-white" />
                        </div>
                      )}

                      {/* Primary Badge */}
                      {image.is_primary && (
                        <div className="absolute top-2 right-2 z-10 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-semibold">
                          Primary
                        </div>
                      )}

                      {/* Image */}
                      <div className="aspect-square">
                        <img
                          src={image.image_url}
                          alt={image.alt_text || 'Product image'}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Action Overlay */}
                      {canEdit && (
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setPrimaryImage(image.id)}
                              disabled={image.is_primary || loading}
                              className={`
                                w-8 h-8 rounded-full flex items-center justify-center transition-colors
                                ${image.is_primary
                                  ? 'bg-yellow-500 text-white'
                                  : 'bg-white text-gray-700 hover:bg-yellow-500 hover:text-white'
                                }
                              `}
                              title={image.is_primary ? 'Primary image' : 'Set as primary'}
                            >
                              {image.is_primary ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                            </button>

                            <button
                              onClick={() => {
                                setEditingImage(image.id);
                                setAltText(image.alt_text || '');
                              }}
                              className="w-8 h-8 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors"
                              title="Edit alt text"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => downloadImage(image.image_url, `product-image-${index + 1}`)}
                              className="w-8 h-8 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-green-500 hover:text-white transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => deleteImage(image.id)}
                              disabled={loading}
                              className="w-8 h-8 bg-white text-gray-700 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Image Info */}
                      <div className="p-3 bg-gray-50">
                        <p className="text-xs text-gray-600 truncate">
                          {image.width && image.height ? `${image.width}×${image.height}` : 'Unknown size'}
                        </p>
                        {image.alt_text && (
                          <p className="text-xs text-gray-800 truncate mt-1" title={image.alt_text}>
                            {image.alt_text}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Alt Text Edit Modal */}
      {editingImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Alt Text</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alternative Text (for accessibility)
                  </label>
                  <textarea
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Describe the image for screen readers..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Good alt text describes the image content clearly and concisely.
                  </p>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setEditingImage(null);
                      setAltText('');
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateAltText(editingImage)}
                    disabled={loading}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGallery;
