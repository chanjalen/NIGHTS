import Header from '@/components/Header';
import DecorativeBorder from '@/components/DecorativeBorder';
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
          <div className="page-title-section">
            <h1 className="section-title">
              Popular
              <br />
              Cities
            </h1>
            <p className="section-subtitle">
              Choose a city to explore its nightlife scene.
            </p>
            <DecorativeBorder />
          </div>
          <CitiesGrid />
        </div>
      </main>
    </>
  );
}
