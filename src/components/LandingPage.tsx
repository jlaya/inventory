import React, { useState } from 'react';
import { 
  Calendar, Clock, Users, X, ChevronLeft, ChevronRight, 
  BookOpen, Check, Phone, Mail, User, MessageSquare,
  Utensils, Star, Plus, Leaf, Award, Smile, ChefHat
} from 'lucide-react';
import recipeImage from '@/assets/recipe.jpeg';

interface LandingPageProps {
  onGoToAdmin: () => void;
}

export default function LandingPage({ onGoToAdmin }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // --- STATE FOR BOOKING MODAL ---
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '19:00',
    guests: '2',
    notes: ''
  });
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingCode, setBookingCode] = useState('');

  // --- STATE FOR LIGHTBOX ---
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // --- STATE FOR BLOG ---
  const [selectedBlogIndex, setSelectedBlogIndex] = useState<number | null>(null);

  const dishes = [
    {
      id: 1,
      name: 'Creamy Alfredo Pasta',
      description: 'White sauce pasta with herbs',
      price: '$12.99',
      image: 'https://images.unsplash.com/photo-1551183053-bf91b1dca034?w=400&h=300&fit=crop',
      badge: 'Best Seller'
    },
    {
      id: 2,
      name: 'Grilled Chicken Steak',
      description: 'Served with veggies & sauce',
      price: '$15.99',
      image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop'
    },
    {
      id: 3,
      name: 'Margherita Pizza',
      description: 'Classic cheese pizza',
      price: '$11.99',
      image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop'
    },
    {
      id: 4,
      name: 'Chocolate Lava Cake',
      description: 'Warm chocolate with ice cream',
      price: '$7.99',
      image: 'https://images.unsplash.com/photo-1624353365286-8f8d2cbcfb8c?w=400&h=300&fit=crop'
    }
  ];

  const galleryImages = [
    {
      url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop',
      title: 'Salón Principal',
      desc: 'Ambiente cálido y acogedor para cenar'
    },
    {
      url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=800&h=600&fit=crop',
      title: 'Arte en la Cocina',
      desc: 'Nuestros chefs preparando platos gourmet'
    },
    {
      url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=600&fit=crop',
      title: 'Pizza Artesanal',
      desc: 'Horno de piedra e ingredientes frescos'
    },
    {
      url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&h=600&fit=crop',
      title: 'Postres Exquisitos',
      desc: 'Dulce final preparado al momento'
    },
    {
      url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&h=600&fit=crop',
      title: 'Mixología Premium',
      desc: 'Cocteles de autor diseñados por expertos'
    },
    {
      url: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop',
      title: 'Mesa Reservada',
      desc: 'Detalles minuciosos para una noche especial'
    }
  ];

  const blogPosts = [
    {
      title: 'El Secreto de la Pasta Alfredo Perfecta',
      excerpt: 'Descubre los ingredientes y el método tradicional italiano para lograr una textura cremosa inigualable sin recurrir a trucos industriales.',
      content: 'Para lograr la verdadera pasta Alfredo italiana, la clave reside en la emulsión del queso Parmigiano-Reggiano de alta calidad envejecido 24 meses y la mantequilla artesanal con el agua de cocción de la pasta. Nuestros chefs dominan la técnica del "mantecare", mezclando enérgicamente fuera del fuego para crear una crema rica y natural sin la necesidad de añadir crema de leche pesada. Un toque de pimienta negra recién molida y hojas de albahaca fresca culminan esta obra de arte que servimos a diario.',
      category: 'Recetas',
      date: 'Julio 10, 2026',
      readTime: '4 min lectura',
      image: 'https://images.unsplash.com/photo-1551183053-bf91b1dca034?w=600&h=400&fit=crop'
    },
    {
      title: 'Del Huerto a la Mesa: Nuestra Filosofía',
      excerpt: 'Apoyamos la agricultura ecológica y local. Conoce cómo seleccionamos cada ingrediente para garantizar el máximo sabor y salud.',
      content: 'En Flavoro, creemos que la calidad de un plato comienza en la tierra. Colaboramos directamente con agricultores de la región para obtener vegetales cultivados bajo prácticas orgánicas y cosechados en su punto óptimo de madurez. Los tomates San Marzano utilizados en nuestras salsas son importados de cooperativas sustentables, y las hierbas finas las cultivamos en nuestro propio huerto urbano. Este compromiso no solo asegura platos llenos de nutrientes y sabor puro, sino que también apoya a nuestra comunidad local.',
      category: 'Filosofía',
      date: 'Julio 05, 2026',
      readTime: '5 min lectura',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=400&fit=crop'
    },
    {
      title: 'Maridaje Perfecto: Carnes y Vinos Tintos',
      excerpt: 'Una guía simple elaborada por nuestro sommelier de la casa para potenciar el sabor de tu corte de carne favorito.',
      content: 'El maridaje de un corte de carne premium como nuestro Grilled Chicken Steak o cortes de res con vino es un arte de equilibrios. Para carnes sazonadas y ricas en grasas saludables, un vino con buena estructura de taninos como un Cabernet Sauvignon o un Malbec es indispensable. Los taninos limpian el paladar realzando la jugosidad de la carne. Para carnes más magras o aves, sugerimos un Pinot Noir o un Merlot más suave que no eclipse los sabores delicados del plato. Descubre nuestra bodega de más de 50 etiquetas seleccionadas.',
      category: 'Maridaje',
      date: 'Junio 28, 2026',
      readTime: '3 min lectura',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop'
    }
  ];

  // --- SMOOTH SCROLL FUNCTION ---
  const scrollToSection = (id: string) => {
    setIsMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // --- BOOKING SUBMISSION ---
  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = `FLV-${Math.floor(1000 + Math.random() * 9000)}`;
    setBookingCode(code);
    setBookingSuccess(true);
  };

  const handleCloseBooking = () => {
    setIsBookingModalOpen(false);
    setTimeout(() => {
      setBookingSuccess(false);
      setBookingForm({
        name: '',
        email: '',
        phone: '',
        date: '',
        time: '19:00',
        guests: '2',
        notes: ''
      });
    }, 300);
  };

  // --- LIGHTBOX CONTROLS ---
  const handlePrevImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + galleryImages.length) % galleryImages.length);
    }
  };

  const handleNextImage = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % galleryImages.length);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfaf6] font-sans scroll-smooth" id="home">
      
      {/* --- Navigation --- */}
      <nav className="bg-gray-950 text-white sticky top-0 z-50 shadow-lg border-b border-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center">
              <div 
                className="flex-shrink-0 cursor-pointer flex items-center gap-3"
                onClick={() => scrollToSection('home')}
              >
                <div className="bg-orange-500 p-2.5 rounded-2xl text-white shadow-md shadow-orange-500/20">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-serif font-black tracking-tight leading-none text-white">
                    Flavoro
                  </h1>
                  <span className="text-[9px] font-sans tracking-widest text-orange-500 block uppercase font-bold mt-0.5">
                    RESTAURANT
                  </span>
                </div>
              </div>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-5">
                <button 
                  onClick={() => scrollToSection('home')} 
                  className="text-orange-500 px-3 py-2 text-sm font-semibold cursor-pointer transition hover:opacity-85"
                >
                  Home
                </button>
                <button 
                  onClick={() => scrollToSection('about')} 
                  className="text-gray-300 hover:text-orange-500 px-3 py-2 text-sm font-semibold transition cursor-pointer"
                >
                  About Us
                </button>
                <button 
                  onClick={() => scrollToSection('menu')} 
                  className="text-gray-300 hover:text-orange-500 px-3 py-2 text-sm font-semibold transition cursor-pointer"
                >
                  Menu
                </button>
                <button 
                  onClick={() => scrollToSection('gallery')} 
                  className="text-gray-300 hover:text-orange-500 px-3 py-2 text-sm font-semibold transition cursor-pointer"
                >
                  Gallery
                </button>
                <button 
                  onClick={() => setIsBookingModalOpen(true)} 
                  className="text-gray-300 hover:text-orange-500 px-3 py-2 text-sm font-semibold transition cursor-pointer"
                >
                  Reservations
                </button>
                <button 
                  onClick={() => scrollToSection('blog')} 
                  className="text-gray-300 hover:text-orange-500 px-3 py-2 text-sm font-semibold transition cursor-pointer"
                >
                  Blog
                </button>
                <button 
                  onClick={() => scrollToSection('contact')} 
                  className="text-gray-300 hover:text-orange-500 px-3 py-2 text-sm font-semibold transition cursor-pointer"
                >
                  Contact
                </button>
                <button
                  onClick={onGoToAdmin}
                  className="text-gray-300 hover:text-orange-500 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer border-2 border-orange-500/30 rounded-full hover:border-orange-500 bg-orange-500/10 hover:bg-orange-500/20"
                >
                  Administración
                </button>
              </div>
            </div>

            {/* Book a Table button */}
            <div className="hidden md:block">
              <button 
                onClick={() => setIsBookingModalOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-full text-sm font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/25"
              >
                <Calendar className="w-4 h-4" />
                Book a Table
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-300 hover:text-white p-2 cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-gray-900 border-t border-gray-800">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <button 
                onClick={() => scrollToSection('home')} 
                className="text-orange-500 block w-full text-left px-3 py-2 text-base font-semibold cursor-pointer"
              >
                Home
              </button>
              <button 
                onClick={() => scrollToSection('about')} 
                className="text-gray-300 hover:text-orange-500 block w-full text-left px-3 py-2 text-base font-semibold cursor-pointer"
              >
                About Us
              </button>
              <button 
                onClick={() => scrollToSection('menu')} 
                className="text-gray-300 hover:text-orange-500 block w-full text-left px-3 py-2 text-base font-semibold cursor-pointer"
              >
                Menu
              </button>
              <button 
                onClick={() => scrollToSection('gallery')} 
                className="text-gray-300 hover:text-orange-500 block w-full text-left px-3 py-2 text-base font-semibold cursor-pointer"
              >
                Gallery
              </button>
              <button 
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsBookingModalOpen(true);
                }} 
                className="text-gray-300 hover:text-orange-500 block w-full text-left px-3 py-2 text-base font-semibold cursor-pointer"
              >
                Reservations
              </button>
              <button 
                onClick={() => scrollToSection('blog')} 
                className="text-gray-300 hover:text-orange-500 block w-full text-left px-3 py-2 text-base font-semibold cursor-pointer"
              >
                Blog
              </button>
              <button 
                onClick={() => scrollToSection('contact')} 
                className="text-gray-300 hover:text-orange-500 block w-full text-left px-3 py-2 text-base font-semibold cursor-pointer"
              >
                Contact
              </button>
              <button 
                onClick={() => {
                  setIsMenuOpen(false);
                  onGoToAdmin();
                }} 
                className="text-orange-400 font-bold block w-full text-left px-3 py-2.5 text-base cursor-pointer border-t border-gray-800 mt-2 pt-2.5 uppercase tracking-wider"
              >
                Administración
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* --- Hero Section --- */}
      <section className="relative bg-gray-950 overflow-hidden py-16 lg:py-24">
        {/* Gradients */}
        <div className="absolute inset-0 bg-black/75 z-10"></div>
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=800&fit=crop" 
            alt="Restaurant background" 
            className="w-full h-full object-cover opacity-30"
          />
        </div>
        
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Content */}
            <div className="space-y-6">
              <p className="text-orange-400 font-script text-3xl italic tracking-wide">
                Good Food, Good Mood ♡
              </p>
              <h1 className="text-5xl lg:text-7xl font-serif font-black text-white leading-tight">
                Delicious Food<br />
                <span className="text-orange-500 font-script text-5xl lg:text-7xl capitalize inline-block mt-2">
                  Made with Love
                </span> ♡
              </h1>
              <p className="text-gray-300 text-lg max-w-md font-sans leading-relaxed">
                Experience the perfect blend of taste, quality and happiness in every bite.
              </p>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button 
                  onClick={() => scrollToSection('menu')}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3.5 rounded-full font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/25 text-sm uppercase tracking-wider"
                >
                  <BookOpen className="w-5 h-5" />
                  Explore Menu
                </button>
                <button 
                  onClick={() => setIsBookingModalOpen(true)}
                  className="border-2 border-white text-white hover:bg-white hover:text-gray-950 px-8 py-3.5 rounded-full font-bold transition flex items-center justify-center gap-2 cursor-pointer text-sm uppercase tracking-wider"
                >
                  <Calendar className="w-5 h-5" />
                  Book a Table
                </button>
              </div>

              {/* Badges bar */}
              <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/10">
                <div className="flex items-start gap-2.5">
                  <div className="bg-orange-500/20 p-2.5 rounded-xl text-orange-500">
                    <Leaf className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xs sm:text-sm uppercase tracking-wider">Fresh Ingredients</h3>
                    <p className="text-gray-400 text-xxs sm:text-xs">100% Fresh & Healthy</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="bg-orange-500/20 p-2.5 rounded-xl text-orange-500">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xs sm:text-sm uppercase tracking-wider">Expert Chefs</h3>
                    <p className="text-gray-400 text-xxs sm:text-xs">10+ Years Experience</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="bg-orange-500/20 p-2.5 rounded-xl text-orange-500">
                    <Smile className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xs sm:text-sm uppercase tracking-wider">Great Ambience</h3>
                    <p className="text-gray-400 text-xxs sm:text-xs">Feel Like Home</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Plate Layout */}
            <div className="relative justify-center hidden lg:flex">
              <img 
                src={recipeImage} 
                alt="Delicious chicken supreme pasta" 
                className="rounded-full shadow-2xl border-[14px] border-gray-800/90 object-cover w-[480px] h-[480px] z-10 relative"
              />

              {/* Circular floating dashed badge - En la esquina superior derecha */}
              <div className="absolute -top-6 -right-6 bg-orange-500 text-white rounded-full w-32 h-32 flex flex-col items-center justify-center text-center font-serif shadow-2xl z-20 border-2 border-dashed border-white/60 animate-pulse">
                <ChefHat className="w-6 h-6 text-white mb-1" />
                <span className="text-[10px] font-sans tracking-widest uppercase text-orange-200">Best</span>
                <span className="text-sm font-bold leading-tight">Food</span>
                <span className="text-[10px] font-sans tracking-wider uppercase text-orange-200 font-bold">In Town</span>
              </div>
              
              {/* Floating leaves decoration */}
              <div className="absolute top-12 left-2 z-20 text-green-500 text-4xl drop-shadow-md select-none animate-bounce">🌿</div>
              <div className="absolute bottom-16 right-4 z-20 text-green-500 text-3xl drop-shadow-md select-none animate-pulse">🌿</div>
              <div className="absolute top-1/2 -right-8 z-20 text-green-500 text-2xl drop-shadow-md select-none">🍃</div>
            </div>
          </div>
        </div>

        {/* Brush Edge SVG Divider */}
        <div className="absolute bottom-0 left-0 right-0 z-35 overflow-hidden leading-[0]">
          <svg className="relative block w-full h-[40px] text-[#fcfaf6] fill-current" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,40 C150,90 350,15 500,60 C650,105 850,25 1000,70 C1150,115 1200,40 1200,40 L1200,120 L0,120 Z" />
          </svg>
        </div>
      </section>

      {/* --- About Section --- */}
      <section className="py-24 bg-[#fcfaf6]" id="about">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Left Image & Floating Experience Card */}
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=450&fit=crop" 
                alt="Restaurant interior" 
                className="rounded-3xl shadow-xl w-full h-[380px] object-cover border border-gray-200/40"
              />
              <div className="absolute -bottom-6 -left-6 bg-white px-6 py-5 rounded-2xl shadow-xl border border-gray-150 flex items-center gap-4">
                <div className="bg-orange-500 text-white p-3.5 rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center">
                  <span className="text-2xl font-serif font-black">10+</span>
                </div>
                <div>
                  <p className="text-gray-900 font-serif font-bold text-sm leading-tight">Years of</p>
                  <p className="text-gray-500 text-xs font-sans tracking-wide">Experience</p>
                </div>
              </div>
            </div>

            {/* Right Text & 2x2 Bento Features */}
            <div className="space-y-8">
              <div>
                <p className="text-orange-500 font-script text-3xl mb-1 tracking-wide">About Us</p>
                <h2 className="text-4xl sm:text-5xl font-serif font-black text-gray-900 leading-tight">
                  We Serve <span className="text-orange-500 font-script text-4xl sm:text-5xl capitalize italic inline-block ml-1">Happiness</span>
                </h2>
                <p className="text-gray-600 mt-4 leading-relaxed font-sans text-sm md:text-base">
                  At Flavoro, we believe that great food brings people together. Our chefs craft every dish with fresh ingredients and a passion for perfection.
                </p>
                <p className="text-orange-600 font-script text-2xl mt-3 tracking-wide">Flavoro Restaurant</p>
              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:scale-105 transition duration-300 flex flex-col items-center text-center">
                  <div className="bg-orange-50 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                    <Leaf className="w-5 h-5 text-orange-500" />
                  </div>
                  <h3 className="font-serif font-bold text-gray-900 text-sm">Fresh Ingredients</h3>
                </div>
                
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:scale-105 transition duration-300 flex flex-col items-center text-center">
                  <div className="bg-orange-50 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                    <Award className="w-5 h-5 text-orange-500" />
                  </div>
                  <h3 className="font-serif font-bold text-gray-900 text-sm">Skilled Chefs</h3>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:scale-105 transition duration-300 flex flex-col items-center text-center">
                  <div className="bg-orange-50 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                    <Clock className="w-5 h-5 text-orange-500" />
                  </div>
                  <h3 className="font-serif font-bold text-gray-900 text-sm">Fast & Friendly</h3>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:scale-105 transition duration-300 flex flex-col items-center text-center">
                  <div className="bg-orange-50 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                    <Smile className="w-5 h-5 text-orange-500" />
                  </div>
                  <h3 className="font-serif font-bold text-gray-900 text-sm">Happy Customers</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Popular Dishes Section --- */}
      <section className="py-24 bg-white" id="menu">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center mb-16">
            <p className="text-orange-500 font-script text-3xl tracking-wide mb-1">Our Menu</p>
            <h2 className="text-4xl sm:text-5xl font-serif font-black text-gray-900">Popular Dishes</h2>
            <div className="w-16 h-1 bg-orange-500 mx-auto mt-4 rounded-full"></div>
          </div>

          {/* Grid of Dishes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {dishes.map((dish) => (
              <div 
                key={dish.id} 
                className="group bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl hover:scale-[1.02] transition duration-350 border border-gray-100 flex flex-col"
              >
                {/* Image */}
                <div className="relative overflow-hidden h-48">
                  <img 
                    src={dish.image} 
                    alt={dish.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                  />
                  {dish.badge && (
                    <span className="absolute top-4 left-4 bg-orange-500 text-white px-3.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-md shadow-orange-500/20">
                      {dish.badge}
                    </span>
                  )}
                </div>
                
                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    {/* Stars rating */}
                    <div className="flex gap-0.5 text-orange-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <h3 className="font-serif font-bold text-gray-900 text-lg leading-snug">{dish.name}</h3>
                    <p className="text-gray-500 text-xs sm:text-sm font-sans line-clamp-2 leading-relaxed">{dish.description}</p>
                  </div>
                  
                  {/* Price & Add button */}
                  <div className="flex justify-between items-center mt-5 pt-3 border-t border-gray-50">
                    <span className="text-orange-500 font-serif font-black text-lg">{dish.price}</span>
                    <button 
                      onClick={() => setIsBookingModalOpen(true)}
                      className="bg-orange-500 hover:bg-orange-650 text-white w-9 h-9 rounded-full flex items-center justify-center shadow-md shadow-orange-500/25 transition cursor-pointer"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Carousel Slider Controls */}
          <div className="flex items-center justify-center gap-5 mt-14">
            <button className="bg-white hover:bg-orange-500 hover:text-white text-gray-700 w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center shadow-sm hover:shadow transition cursor-pointer">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 cursor-pointer"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300 hover:bg-gray-400 cursor-pointer transition"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300 hover:bg-gray-400 cursor-pointer transition"></span>
            </div>
            <button className="bg-white hover:bg-orange-500 hover:text-white text-gray-700 w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center shadow-sm hover:shadow transition cursor-pointer">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* --- Gallery Section --- */}
      <section className="py-24 bg-[#fcfaf6]" id="gallery">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-script text-3xl tracking-wide mb-1">Vibe & Style</p>
            <h2 className="text-4xl sm:text-5xl font-serif font-black text-gray-900">Nuestra Galería</h2>
            <div className="w-16 h-1 bg-orange-500 mx-auto mt-4 rounded-full"></div>
            <p className="text-gray-500 mt-4 max-w-md mx-auto text-sm font-sans">
              Echa un vistazo a la calidez de nuestro espacio y la delicadeza de nuestras creaciones culinarias.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryImages.map((img, idx) => (
              <div 
                key={idx} 
                onClick={() => setLightboxIndex(idx)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl shadow-md transition duration-350 hover:shadow-xl border border-gray-200/50"
              >
                <img 
                  src={img.url} 
                  alt={img.title} 
                  className="w-full h-[260px] object-cover transition-transform duration-550 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-350 flex flex-col justify-end p-6 z-10">
                  <h4 className="text-white font-serif font-bold text-lg">{img.title}</h4>
                  <p className="text-gray-300 text-xs mt-1 font-sans">{img.desc}</p>
                </div>
                <div className="absolute top-4 right-4 bg-orange-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition duration-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Blog Section --- */}
      <section className="py-24 bg-white" id="blog">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-script text-3xl tracking-wide mb-1">Últimas Historias</p>
            <h2 className="text-4xl sm:text-5xl font-serif font-black text-gray-900">Flavoro Blog</h2>
            <div className="w-16 h-1 bg-orange-500 mx-auto mt-4 rounded-full"></div>
            <p className="text-gray-500 mt-4 max-w-md mx-auto text-sm font-sans">
              Secretos de cocina, filosofía y las mejores combinaciones culinarias explicadas por nuestro equipo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {blogPosts.map((post, idx) => (
              <article 
                key={idx} 
                className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col hover:shadow-lg transition duration-300"
              >
                <img 
                  src={post.image} 
                  alt={post.title} 
                  className="w-full h-[200px] object-cover"
                />
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                    <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">{post.category}</span>
                    <span>&bull;</span>
                    <span>{post.date}</span>
                  </div>
                  <h3 
                    className="font-serif font-bold text-gray-900 text-lg mb-2 line-clamp-2 hover:text-orange-500 transition cursor-pointer leading-snug" 
                    onClick={() => setSelectedBlogIndex(idx)}
                  >
                    {post.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3 leading-relaxed flex-1 font-sans">
                    {post.excerpt}
                  </p>
                  <button 
                    onClick={() => setSelectedBlogIndex(idx)}
                    className="text-orange-500 hover:text-orange-655 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer self-start"
                  >
                    Leer artículo completo
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --- Reservation Banner --- */}
      <section className="py-12 bg-[#fcfaf6]" id="reservations">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-950 text-white rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-2xl border border-gray-900">
            {/* Background overlay */}
            <div className="absolute inset-0 opacity-15">
              <img 
                src="https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&h=400&fit=crop" 
                alt="Background" 
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Content layout */}
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="bg-orange-500 text-white p-4.5 rounded-2xl shadow-lg shadow-orange-500/25 flex items-center justify-center">
                  <Calendar className="w-9 h-9" />
                </div>
                <div className="text-center sm:text-left">
                  <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mb-1">
                    Reserve Your Table Now!
                  </h2>
                  <p className="text-gray-400 font-sans text-sm sm:text-base">
                    Good food is better when shared with the ones you love.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsBookingModalOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3.5 rounded-full font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer shadow-lg shadow-orange-500/25 text-sm uppercase tracking-wider"
              >
                <Calendar className="w-4 h-4" />
                Book a Table
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="bg-gray-950 text-white pt-20 pb-10 relative overflow-hidden" id="contact">
        
        {/* Decorative absolute ingredients bottom-right */}
        <div className="absolute right-0 bottom-0 pointer-events-none overflow-hidden h-[260px] w-[260px] hidden lg:block z-0">
          <img 
            src="https://images.unsplash.com/photo-1595855759920-86582396756a?w=160&fit=crop" 
            alt="Tomato decoration" 
            className="absolute -right-6 -bottom-6 w-32 h-32 object-cover rounded-full shadow-2xl opacity-80 rotate-12"
          />
          <span className="absolute bottom-20 right-24 text-4xl drop-shadow-md select-none animate-pulse">🌿</span>
          <span className="absolute bottom-28 right-8 text-3xl drop-shadow-md select-none">🍃</span>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            
            {/* Brand Column */}
            <div className="space-y-4">
              <div 
                className="cursor-pointer flex items-center gap-3"
                onClick={() => scrollToSection('home')}
              >
                <div className="bg-orange-500 p-2 rounded-xl text-white">
                  <Utensils className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-serif font-black text-white">Flavoro</h3>
              </div>
              <p className="text-xs tracking-wider text-gray-500 uppercase font-bold mt-1">RESTAURANT</p>
              <p className="text-gray-400 text-sm leading-relaxed font-sans">
                Flavoro is where taste meets passion. We serve delicious food, great vibes, and unforgettable moments.
              </p>
              <div className="flex gap-3 pt-2">
                <a href="#" className="bg-gray-900 hover:bg-orange-500 w-9 h-9 rounded-full flex items-center justify-center transition border border-gray-800">
                  <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="#" className="bg-gray-900 hover:bg-orange-500 w-9 h-9 rounded-full flex items-center justify-center transition border border-gray-800">
                  <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
                <a href="#" className="bg-gray-900 hover:bg-orange-500 w-9 h-9 rounded-full flex items-center justify-center transition border border-gray-800">
                  <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204 013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0 3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Quick Links Column */}
            <div>
              <h4 className="text-lg font-serif font-bold mb-5 text-orange-500">Quick Links</h4>
              <ul className="space-y-3">
                <li>
                  <button 
                    onClick={() => scrollToSection('home')} 
                    className="text-gray-405 hover:text-orange-500 transition text-sm flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0"
                  >
                    <ChevronRight className="w-4 h-4 text-orange-500" />
                    Home
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => scrollToSection('about')} 
                    className="text-gray-405 hover:text-orange-500 transition text-sm flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0"
                  >
                    <ChevronRight className="w-4 h-4 text-orange-500" />
                    About Us
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => scrollToSection('menu')} 
                    className="text-gray-405 hover:text-orange-500 transition text-sm flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0"
                  >
                    <ChevronRight className="w-4 h-4 text-orange-500" />
                    Menu
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => scrollToSection('gallery')} 
                    className="text-gray-405 hover:text-orange-500 transition text-sm flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0"
                  >
                    <ChevronRight className="w-4 h-4 text-orange-500" />
                    Gallery
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setIsBookingModalOpen(true)} 
                    className="text-gray-405 hover:text-orange-500 transition text-sm flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0"
                  >
                    <ChevronRight className="w-4 h-4 text-orange-500" />
                    Reservations
                  </button>
                </li>
                <li>
                  <button 
                    onClick={onGoToAdmin}
                    className="text-orange-400 hover:text-orange-500 transition text-sm flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0 font-bold uppercase tracking-wider text-[11px]"
                  >
                    <ChevronRight className="w-4 h-4 text-orange-500" />
                    Administración
                  </button>
                </li>
              </ul>
            </div>

            {/* Opening Hours Column */}
            <div>
              <h4 className="text-lg font-serif font-bold mb-5 text-orange-500">Opening Hours</h4>
              <div className="space-y-4 font-sans text-sm">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Monday - Friday</p>
                  <p className="text-white font-semibold mt-0.5">11:00 AM - 10:00 PM</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Saturday - Sunday</p>
                  <p className="text-white font-semibold mt-0.5">10:00 AM - 11:00 PM</p>
                </div>
                <p className="text-orange-550 font-script text-xl pt-2">We are Open Everyday!</p>
              </div>
            </div>

            {/* Contact Column */}
            <div>
              <h4 className="text-lg font-serif font-bold mb-5 text-orange-500">Contact Us</h4>
              <ul className="space-y-4 text-sm font-sans">
                <li className="flex items-start gap-3">
                  <Phone className="w-4.5 h-4.5 text-orange-500 mt-0.5 shrink-0" />
                  <span className="text-gray-400">+1 234 567 8900</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="w-4.5 h-4.5 text-orange-500 mt-0.5 shrink-0" />
                  <span className="text-gray-400">info@flavoro.com</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-4.5 h-4.5 text-orange-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-400">123 Food Street,<br />New York, USA 10001</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="border-t border-gray-900 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-sans text-gray-500">
            <p>© 2025 Flavoro Restaurant. All Rights Reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-orange-500 transition">Privacy Policy</a>
              <a href="#" className="hover:text-orange-500 transition">Terms & Conditions</a>
            </div>
          </div>
        </div>
      </footer>

      {/* --- BOOKING RESERVATION MODAL --- */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-gray-950 text-white px-6 py-5 flex items-center justify-between border-b border-gray-900">
              <div>
                <h3 className="text-xl font-serif font-bold">Reserva tu Mesa</h3>
                <p className="text-xs text-orange-400 font-script italic mt-0.5">Flavoro Dining Experience</p>
              </div>
              <button 
                onClick={handleCloseBooking}
                className="text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-gray-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {!bookingSuccess ? (
                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 block">Nombre Completo</label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          required
                          value={bookingForm.name}
                          onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                          placeholder="Tu nombre" 
                          className="pl-9 pr-3 py-2.5 w-full border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                        />
                      </div>
                    </div>
                    {/* Phone */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 block">Teléfono de Contacto</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <input 
                          type="tel" 
                          required
                          value={bookingForm.phone}
                          onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                          placeholder="+1 234 567 89" 
                          className="pl-9 pr-3 py-2.5 w-full border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 block">Correo Electrónico</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input 
                        type="email" 
                        required
                        value={bookingForm.email}
                        onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                        placeholder="tuemail@correo.com" 
                        className="pl-9 pr-3 py-2.5 w-full border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Date */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 block">Fecha</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <input 
                          type="date" 
                          required
                          value={bookingForm.date}
                          onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                          className="pl-9 pr-3 py-2.5 w-full border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                        />
                      </div>
                    </div>
                    {/* Time */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 block">Hora</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <select 
                          value={bookingForm.time}
                          onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })}
                          className="pl-9 pr-3 py-2.5 w-full border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                        >
                          <option value="12:00">12:00 PM</option>
                          <option value="13:00">1:00 PM</option>
                          <option value="14:00">2:00 PM</option>
                          <option value="15:00">3:00 PM</option>
                          <option value="18:00">6:00 PM</option>
                          <option value="19:00">7:00 PM</option>
                          <option value="20:00">8:00 PM</option>
                          <option value="21:00">9:00 PM</option>
                          <option value="22:00">10:00 PM</option>
                        </select>
                      </div>
                    </div>
                    {/* Guests */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 block">Comensales</label>
                      <div className="relative">
                        <Users className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <select 
                          value={bookingForm.guests}
                          onChange={(e) => setBookingForm({ ...bookingForm, guests: e.target.value })}
                          className="pl-9 pr-3 py-2.5 w-full border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                        >
                          <option value="1">1 Persona</option>
                          <option value="2">2 Personas</option>
                          <option value="3">3 Personas</option>
                          <option value="4">4 Personas</option>
                          <option value="5">5 Personas</option>
                          <option value="6">6+ Personas</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 block">Notas especiales</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                      <textarea 
                        value={bookingForm.notes}
                        onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                        placeholder="Ej. Alérgicos, mesa en terraza..." 
                        rows={2}
                        className="pl-9 pr-3 py-2.5 w-full border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
                      ></textarea>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-full text-sm transition shadow-lg shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-2 mt-4 uppercase tracking-wider"
                  >
                    Confirmar Reservación
                  </button>
                </form>
              ) : (
                <div className="py-8 text-center space-y-6 animate-in fade-in duration-200">
                  <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-md">
                    <Check className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-serif font-black text-gray-900">¡Reserva Confirmada!</h4>
                    <p className="text-gray-500 text-xs mt-1 font-sans">Hemos registrado tus detalles y generado tu boleto.</p>
                  </div>

                  <div className="bg-orange-50/70 border border-orange-100 rounded-2xl p-5 max-w-sm mx-auto shadow-sm">
                    <p className="text-xxs font-bold uppercase text-orange-600 tracking-widest">Código de Reserva</p>
                    <p className="text-3xl font-mono font-black text-gray-950 mt-1">{bookingCode}</p>
                    <div className="grid grid-cols-2 gap-3 text-left mt-4 pt-4 border-t border-orange-100 text-xs text-gray-700 font-sans">
                      <div>
                        <strong>Nombre:</strong> {bookingForm.name}
                      </div>
                      <div>
                        <strong>Fecha:</strong> {bookingForm.date}
                      </div>
                      <div>
                        <strong>Hora:</strong> {bookingForm.time} hs
                      </div>
                      <div>
                        <strong>Mesa para:</strong> {bookingForm.guests}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleCloseBooking}
                    className="bg-gray-950 hover:bg-gray-900 text-white font-bold px-8 py-2.5 rounded-full text-sm transition cursor-pointer shadow-md uppercase tracking-wider"
                  >
                    Cerrar Ventana
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- GALLERY LIGHTBOX MODAL --- */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          {/* Close Button */}
          <button 
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Left Arrow */}
          <button 
            onClick={handlePrevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Image Container */}
          <div className="max-w-4xl max-h-[80vh] flex flex-col items-center gap-4 px-8">
            <img 
              src={galleryImages[lightboxIndex].url} 
              alt={galleryImages[lightboxIndex].title} 
              className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            <div className="text-center">
              <h3 className="text-white font-serif font-bold text-xl">{galleryImages[lightboxIndex].title}</h3>
              <p className="text-gray-400 text-xs mt-1 font-sans">{galleryImages[lightboxIndex].desc}</p>
            </div>
          </div>

          {/* Right Arrow */}
          <button 
            onClick={handleNextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Index indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-gray-500 text-xs">
            {lightboxIndex + 1} de {galleryImages.length}
          </div>
        </div>
      )}

      {/* --- BLOG ARTICLE READ MODAL --- */}
      {selectedBlogIndex !== null && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-200 animate-in fade-in zoom-in duration-200">
            {/* Image Header */}
            <div className="relative h-[250px] bg-gray-900">
              <img 
                src={blogPosts[selectedBlogIndex].image} 
                alt={blogPosts[selectedBlogIndex].title} 
                className="w-full h-full object-cover opacity-80"
              />
              <button 
                onClick={() => setSelectedBlogIndex(null)}
                className="absolute top-4 right-4 bg-black/60 text-white hover:bg-black/80 p-2 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-6">
                <span className="bg-orange-500 text-white px-3 py-1 rounded font-bold uppercase text-[10px] tracking-wider">
                  {blogPosts[selectedBlogIndex].category}
                </span>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 md:p-8 space-y-4">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>Por Flavoro Cocina</span>
                <span>&bull;</span>
                <span>{blogPosts[selectedBlogIndex].date}</span>
                <span>&bull;</span>
                <span>{blogPosts[selectedBlogIndex].readTime}</span>
              </div>
              
              <h3 className="font-serif font-bold text-gray-900 text-2xl md:text-3xl leading-snug">
                {blogPosts[selectedBlogIndex].title}
              </h3>
              
              <p className="text-gray-700 leading-relaxed text-sm md:text-base whitespace-pre-line font-sans">
                {blogPosts[selectedBlogIndex].content}
              </p>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => setSelectedBlogIndex(null)}
                  className="bg-orange-500 hover:bg-orange-650 text-white font-bold px-6 py-2.5 rounded-full text-sm transition cursor-pointer uppercase tracking-wider"
                >
                  Cerrar Artículo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
