const iconBaseURL = 'https://static.prepleaf.com/icons/app';
const defaultIcon = 'AOD.png';
const subTopicIcons = {
	'Alcohol, Phenol and Ether': 'Alcohol, Phenol and Ether.png',
	'Atomic Structure': 'Atomic Structure.png',
	'Carbonyl compound and Acid derivatives':
		'Carbonyl compound and Acid derivatives.png',
	'Chemical Bonding': 'Chemical Bonding.png',
	'Chemical Equilibrium': 'Chemical Equilibrium.png',
	'Chemistry in everyday life': 'Chemistry in everyday life.png',
	'Coordination Compound': 'Coordination Compound.png',
	Electrochemistry: 'Electrochemistry.png',
	'General Organic Chemistry': 'General Organic Chemistry.png',
	'Halogen containing compounds': 'Halogen containing compounds.png',
	'Ionic Equilibrium': 'Ionic Equilibrium.png',
	'Isomerism & IUPAC Nomenclature': 'Isomerism & IUPAC Nomenclature.png',
	Metallurgy: 'Metallurgy.png',
	'Mole Concept': 'Mole Concept.png',
	'Nuclear Chemistry': 'Nuclear Chemistry.png',
	'Periodic Table': 'Periodic Table.png',
	'Purification and Characterization of Organic Compounds':
		'Purification and Characterization of Organic Compounds.png',
	Redox: 'Redox.png',
	'Reduction Oxidation and Hydrolysis': 'Reduction Oxidation and Hydrolysis.png',
	'S Block': 'S Block.png',
	'Salt Analysis': 'Salt Analysis.png',
	'Solid States': 'Solid States.png',
	'Solution and Colligative Property': 'Solution and Colligative Property.png',
	'Surface Chemistry': 'Surface Chemistry.png',
	'Thermodynamics and Thermochemistry': 'Thermodynamics and Thermochemistry.png',
	'Mechanics 1': 'cosine-graph.png',
	'3D Geometry': '3D Geometry.png',
	AOD: 'AOD.png',
	AUC: 'AUC.png',
	'Binomial Theorem': 'Binomial Theorem.png',
	Circle: 'Circle.png',
	'Complex Numbers': 'Complex Numbers.png',
	'Definite Integration': 'Definite Integration.png',
	'Differential Equation': 'Differential Equation.png',
	Ellipse: 'Ellipse.png',
	'Functions and Relation': 'Functions and Relation.png',
	'Fundamental of Mathematics': 'Fundamental of Mathematics.png',
	Hyperbola: 'Hyperbola.png',
	'Indefinite Integration': 'Indefinite Integration.png',
	'Limits, Continuity and Differentiability':
		'Limits, Continuity and Differentiability.png',
	MOD: 'MOD.png',
	'Matrices and Determinants': 'Matrices and Determinants.png',
	Parabola: 'Parabola.png',
	'Permutations and Combinations': 'Permutations and Combinations.png',
	Probability: 'Probability.png',
	'Quadratic Equation': 'Quadratic Equation.PNG',
	SOT: 'SOT.png',
	'Sequence & Series': 'Sequence & Series.png',
	Statistics: 'Statistics.png',
	'Straight Line': 'Straight Line.png',
	Trigonometry: 'Trigonometry.png',
	'Vector 3D': 'Vector 3D.png',
	'Aldehydes and Ketones': 'Aldehydes and Ketones.png',
	'Amines and Diazonium Salt': 'Amines and Diazonium Salt.png',
	'Aromatic Compound': 'Aromatic Compound.png',
	'Bio molecules and Polymers': 'Bio molecules and Polymers.png',
	'Chemical Kinetics': 'Chemical Kinetics.png',
	'Gaseous State': 'Gaseous State.png',
	Hydrocarbon: 'Hydrocarbon.png',
	'P Block': 'P Block.png',
	'Alternating Current': 'Alternating Current.png',
	Capacitance: 'Capacitance.png',
	'Center of Mass': 'Center of Mass.png',
	'Circular Motion': 'Circular Motion.png',
	'Current Electricity': 'Current Electricity.png',
	EMI: 'EMI.png',
	'Elasticity and Viscosity': 'Elasticity and Viscosity.png',
	'Electromagnetic Waves': 'Electromagnetic Waves.png',
	Electrostatics: 'Electrostatics.png',
	'Fluid Mechanics': 'Fluid Mechanics.png',
	Friction: 'Friction.png',
	'Geometric Optics': 'Geometric Optics.png',
	Gravitation: 'Gravitation.png',
	'Magnetic Effect of Current (MEC)': 'Magnetic Effect of Current (MEC).png',
	Magnetism: 'Magnetism.png',
	'Math for physics': 'Math for physics.png',
	NLM: 'NLM.png',
	Projectile: 'Projectile.png',
	'Rectilinear Motion': 'Rectilinear Motion.png',
	'Relative Motion': 'Relative Motion.png',
	'Rotation (RBD)': 'Rotation (RBD).png',
	'Sound Waves': 'Sound Waves.png',
	'String Waves': 'String Waves.png',
	'Surface Tension': 'Surface Tension.png',
	'Thermodynamics and KTG': 'Thermodynamics and KTG.png',
	WPE: 'WPE.png',
	'Wave Optics': 'Wave Optics.png',
};

const getURLFromIcon = (icon) => {
	if (icon && icon.indexOf('https://') === 0) {
		return icon;
	} else if (icon) {
		return `${iconBaseURL}/${icon}`;
	}
	return getURLFromIcon(defaultIcon);
};

const getIconForSubTopic = (subTopic) => {
	let icon;
	if (subTopic) {
		if (typeof subTopic === 'string') {
			icon = subTopicIcons[subTopic];
		} else if (typeof subTopic === 'object') {
			try {
				icon = subTopicIcons[subTopic.name];
				if (!icon) {
					icon = subTopicIcons[subTopic._id];
				}
				// eslint-disable-next-line no-empty
			} catch (e) {}
		}
	}
	return getURLFromIcon(icon);
};

module.exports = {
	getIconForSubTopic,
};
