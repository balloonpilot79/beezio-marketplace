import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const CreateCausePage: React.FC = () => {
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error: dbError } = await supabase.from('causes').insert({
        title,
        story,
        goal_amount: parseFloat(goalAmount),
        image_url: imageUrl,
        raised_amount: 0,
        // owner_id: current user id (add if you have auth)
      });
      if (dbError) throw dbError;
      setSuccess('Cause created! You can now link products to this cause.');
      setTitle('');
      setStory('');
      setGoalAmount('');
      setImageUrl('');
    } catch (err: any) {
      setError(err.message || 'Failed to create cause.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-6">Create a Cause</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block font-medium mb-1">Title</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border px-3 py-2 rounded" required />
        </div>
        <div>
          <label className="block font-medium mb-1">Story</label>
          <textarea value={story} onChange={e => setStory(e.target.value)} className="w-full border px-3 py-2 rounded" rows={5} required />
        </div>
        <div>
          <label className="block font-medium mb-1">Goal Amount</label>
          <input type="number" value={goalAmount} onChange={e => setGoalAmount(e.target.value)} className="w-full border px-3 py-2 rounded" required />
        </div>
        <div>
          <label className="block font-medium mb-1">Image URL</label>
          <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full border px-3 py-2 rounded" />
        </div>
        <button type="submit" disabled={loading} className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600">{loading ? 'Creating...' : 'Create Cause'}</button>
        {success && <div className="text-green-600 mt-2">{success}</div>}
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </form>
      <div className="mt-8 text-gray-600 text-sm">
        After creating a cause, you can link products to it by editing your products and setting their <b>cause</b> field.
      </div>
    </div>
  );
};

export default CreateCausePage;
