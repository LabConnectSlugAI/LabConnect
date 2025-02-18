"use client"; 
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Lab {
  id: number;
  Department: string;
  "Professor Name": string;
  Contact: string;
  "Lab Name": string;
  "Department/Major": string;
  "How to apply": string;
  Description: string;
}

export default function LabSearch() {
  const [major, setMajor] = useState<string>('');  // Explicitly set string type
  const [labs, setLabs] = useState<Lab[]>([]); // Define 'labs' as an array of Lab objects
  const [loading, setLoading] = useState<boolean>(false);

  const fetchLabs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("labconnect").select("*");
    if (error) console.error(error);
    else setLabs(data || []); // Ensure data is an array

    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black-100 p-6">
      <h1 className="text-3xl font-bold mb-4">LabConnect</h1>
      <p className="mb-4">Find labs based on your major!</p>

      <input
        type="text"
        placeholder="Enter your major"
        value={major}
        onChange={(e) => setMajor(e.target.value)}
        className="p-2 border rounded w-80 mb-2 text-black"
      />
      <button
        onClick={fetchLabs}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {loading ? 'Searching...' : 'Find Labs'}
      </button>

      <div className="mt-6 w-full max-w-2xl">
        {labs.length > 0 ? (
          labs.map((lab) => (
            <div key={lab.id} className="p-4 bg-white shadow rounded mb-4 text-black">
              <h2 className="text-xl font-bold">{lab['Lab Name']}</h2>
              <p><strong>Professor:</strong> {lab['Professor Name']}</p>
              <p><strong>Contact:</strong> {lab['Contact']}</p>
              <p><strong>How to Apply:</strong> {lab['How to apply']}</p>
              <p className="text-grey-600">{lab['Description']}</p>
            </div>
          ))
        ) : (
          !loading && <p>No labs found for this major.</p>
        )}
      </div>
    </div>
  );
}
