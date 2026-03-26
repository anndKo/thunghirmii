-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'landlord', 'tenant');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Create rooms table
CREATE TABLE public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    room_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(12, 0) NOT NULL,
    area DECIMAL(6, 2),
    province TEXT NOT NULL,
    district TEXT NOT NULL,
    ward TEXT NOT NULL,
    address_detail TEXT NOT NULL,
    phone TEXT NOT NULL,
    amenities TEXT[],
    images TEXT[],
    videos TEXT[],
    is_available BOOLEAN DEFAULT TRUE,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create room_requests table
CREATE TABLE public.room_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'forwarded')),
    admin_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_requests ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- Create function to check if user is first (admin)
CREATE OR REPLACE FUNCTION public.is_first_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Rooms policies
CREATE POLICY "Anyone can view available rooms" ON public.rooms FOR SELECT USING (is_available = true OR landlord_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Landlords can insert rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() = landlord_id AND public.has_role(auth.uid(), 'landlord'));
CREATE POLICY "Landlords can update own rooms" ON public.rooms FOR UPDATE USING (auth.uid() = landlord_id);
CREATE POLICY "Admin can manage all rooms" ON public.rooms FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Room requests policies
CREATE POLICY "Tenants can create requests" ON public.room_requests FOR INSERT WITH CHECK (auth.uid() = tenant_id AND public.has_role(auth.uid(), 'tenant'));
CREATE POLICY "Tenants can view own requests" ON public.room_requests FOR SELECT USING (auth.uid() = tenant_id);
CREATE POLICY "Admin can view all requests" ON public.room_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update requests" ON public.room_requests FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Landlords can view forwarded requests" ON public.room_requests FOR SELECT USING (
    status = 'forwarded' AND EXISTS (
        SELECT 1 FROM public.rooms WHERE rooms.id = room_requests.room_id AND rooms.landlord_id = auth.uid()
    )
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_room_requests_updated_at BEFORE UPDATE ON public.room_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();