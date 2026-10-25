import { Route, Routes } from 'react-router-dom';
import { Notice, Page } from '@/components/ui';
import BucketScreen from './BucketScreen';
import Overview from './Overview';
import ProjectScreen from './ProjectScreen';
import { useWorkflow, WorkflowProvider } from './store';

// The Work tab: overview at /work, a bucket at /work/b/:id, a project at /work/p/:id.

export default function Workflow() {
  return (
    <WorkflowProvider>
      <Page>
        <Screens />
      </Page>
    </WorkflowProvider>
  );
}

function Screens() {
  const { loading, error } = useWorkflow();
  if (loading) return <p className="py-10 text-center text-muted">Loading Workflow…</p>;
  if (error) return <div className="pt-6"><Notice tone="rose">{error}</Notice></div>;
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="b/:id" element={<BucketScreen />} />
      <Route path="p/:id" element={<ProjectScreen />} />
      <Route path="*" element={<Overview />} />
    </Routes>
  );
}
