import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: { slug: string } }) {
  const { slug } = await params;

  const { data, error } = await supabase
    .from('apresentacoes_salvas')
    .select('html_content')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    notFound();
  }

  return (
    <div 
      dangerouslySetInnerHTML={{ __html: data.html_content }} 
    />
  );
}