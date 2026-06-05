import Header from '@/components/Header';
import CitiesGrid from '@/components/CitiesGrid';

export const metadata = {
  title: 'Popular Cities — NITE',
};

export default function PopularCitiesPage() {
  return (
    <>
      <Header />
      <main>
        <div className="container">
          <CitiesGrid />
        </div>
      </main>
    </>
  );
}
