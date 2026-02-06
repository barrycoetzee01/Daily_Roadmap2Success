import { Helmet } from 'react-helmet-async';
import DailyRoadmap from '@/components/DailyRoadmap';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Daily Success Roadmap - Track Your Daily Progress</title>
        <meta name="description" content="Beautiful daily task roadmap with progress tracking, time management, and motivational messages. Stay productive and achieve your goals." />
      </Helmet>
      <DailyRoadmap />
    </>
  );
};

export default Index;
