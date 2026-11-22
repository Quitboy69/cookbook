"""Grundnahrungsmittel mit deutschen Namen. Werte je 100 g (bzw. 100 ml) aus USDA FoodData Central (SR Legacy, gemeinfrei);
   Zubereitete/regionale Sachen ohne USDA-Eintrag haben eigene Richtwerte (Liste in M = manuell)."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
WORK = os.environ.get('YBWYE_DATA', os.path.join(HERE, 'work')) + '/'   # Download-/Zwischenordner (nicht im Repo)

import sys, json, re
sys.path.insert(0, HERE)
import usda

# (Name, Suchwörter, Emoji, Kategorie, Portion g/ml, Einheit, Quelle[, 'ml'])
# Quelle: Regex für USDA-Beschreibung  ODER  Liste [kcal, Eiweiß, KH, Zucker, Fett, ges. Fett, Ballast, Salz g]
G = [
 # --- Beilagen & Getreide
 ('Nudeln, gekocht (Spaghetti, Penne …)', 'spaghetti nudeln pasta penne fusilli makkaroni tagliatelle spiralen', '🍝', 'Beilage', 250, 'Teller', r'^Pasta, cooked, enriched, without added salt'),
 ('Nudeln, trocken (ungekocht)', 'nudeln roh trocken spaghetti pasta ungekocht', '🍝', 'Beilage', 80, 'Portion roh', r'^Pasta, dry, enriched$'),
 ('Reis, gekocht', 'reis basmati jasmin langkorn', '🍚', 'Beilage', 200, 'Portion', r'^Rice, white, long-grain, regular, enriched, cooked'),
 ('Vollkornreis, gekocht', 'naturreis vollkornreis braunreis', '🍚', 'Beilage', 200, 'Portion', r"^Rice, brown, long-grain, cooked"),
 ('Erdäpfel (Kartoffeln), gekocht', 'erdapfel erdäpfel kartoffel salzkartoffel kartoffeln', '🥔', 'Beilage', 250, 'Portion', r'^Potatoes, boiled, cooked without skin, flesh, without salt'),
 ('Pommes frites (Ofen)', 'pommes fritten pommes frites french fries', '🍟', 'Beilage', 150, 'Portion', r'^Potatoes, french fried, steak fries, salt added in processing, frozen, o'),
 ('Erdäpfelpüree', 'kartoffelpüree erdäpfelpüree püree kartoffelbrei stampfkartoffeln', '🥔', 'Beilage', 250, 'Portion', [110, 2, 14, 1.5, 5, 3, 1.5, 0.7]),
 ('Bratkartoffeln / Röstkartoffeln', 'bratkartoffeln röstkartoffeln röstis rösti', '🥔', 'Beilage', 250, 'Portion', [165, 2.8, 21, 1.2, 8, 1, 2.2, 0.6]),
 ('Knödel (Semmelknödel)', 'knödel semmelknödel serviettenknödel', '🥟', 'Beilage', 160, '2 Stück', [190, 6.5, 33, 2, 3.5, 1.2, 2, 0.9]),
 ('Couscous, gekocht', 'couscous', '🍚', 'Beilage', 200, 'Portion', [112, 3.8, 23, 0.1, 0.2, 0, 1.4, 0.01]),
 ('Haferflocken', 'haferflocken porridge hafer oats', '🥣', 'Getreide', 50, 'Portion', r'^Cereals, oats, regular and quick, not fortified, dry'),
 ('Müsli (Früchtemüsli)', 'müsli muesli früchtemüsli', '🥣', 'Getreide', 60, 'Portion', [360, 9, 63, 18, 6.5, 1.2, 8, 0.1]),
 ('Granola / Knuspermüsli', 'granola knuspermüsli crunchy', '🥣', 'Getreide', 50, 'Portion', r'^Cereals ready-to-eat, granola, homemade'),
 ('Cornflakes', 'cornflakes frühstücksflocken kellogg', '🥣', 'Getreide', 40, 'Portion', r'^Cereals ready-to-eat, RALSTON Corn Flakes'),
 ('Semmel / Kaisersemmel', 'semmel kaisersemmel brötchen weckerl weckerln kaiser', '🥖', 'Brot', 50, 'Stück', r'^Rolls, hard \(includes kaiser\)'),
 ('Vollkornbrot', 'vollkornbrot brot vollkorn', '🍞', 'Brot', 50, 'Scheibe', r'^Bread, whole-wheat, commercially prepared$'),
 ('Roggenbrot / Mischbrot', 'roggenbrot mischbrot bauernbrot brot', '🍞', 'Brot', 50, 'Scheibe', r'^Bread, rye$'),
 ('Weißbrot / Toastbrot', 'toast toastbrot weißbrot weissbrot', '🍞', 'Brot', 28, 'Scheibe', r'^Bread, white, commercially prepared, low sodium, no salt'),
 ('Baguette', 'baguette stangenweißbrot', '🥖', 'Brot', 60, '1/4 Stück', r'^Bread, french or vienna \(includes sourdough\)'),
 ('Brezel (Laugenbrezel)', 'brezel breze laugenbrezel pretzel', '🥨', 'Brot', 90, 'Stück', [265, 8.5, 50, 3, 3.5, 0.6, 3, 3.0]),
 ('Salzstangerl / Salzbrezeln', 'salzstangerl salzstangen salzbrezeln', '🥨', 'Snack', 40, 'Handvoll', r'^Snacks, pretzels, hard, plain, salted'),
 ('Croissant / Kipferl', 'croissant kipferl buttercroissant', '🥐', 'Gebäck', 60, 'Stück', r'^Croissants, butter'),
 ('Knäckebrot', 'knäckebrot knäcke roggen cracker', '🍞', 'Brot', 12, 'Scheibe', r'^Crackers, rye, wafers, plain'),
 ('Reiswaffel / Reiscracker', 'reiswaffel reiscracker puffreis', '🍘', 'Snack', 9, 'Stück', [387, 8, 81, 0.9, 3.2, 0.6, 3, 0.4]),
 ('Bagel', 'bagel', '🥯', 'Gebäck', 90, 'Stück', r'^Bagels, plain, enriched, with calcium propionate'),
 ('Mehl (Weizenmehl)', 'mehl weizenmehl', '🌾', 'Backen', 30, 'Portion', r'^Wheat flour, white, all-purpose, enriched, bleached'),
 # --- Milch & Eier
 ('Vollmilch (3,5 %)', 'milch vollmilch frischmilch trinkmilch', '🥛', 'Milch', 250, 'Glas', r'^Milk, whole, 3.25% milkfat, with added vitamin D', 'ml'),
 ('Fettarme Milch (1,5 %)', 'milch fettarm leichtmilch 1,5', '🥛', 'Milch', 250, 'Glas', r'^Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D', 'ml'),
 ('Magermilch', 'magermilch milch fettfrei', '🥛', 'Milch', 250, 'Glas', r'^Milk, nonfat, fluid, with added vitamin A and vitamin D', 'ml'),
 ('Schokomilch / Kakao (fertig)', 'schokomilch kakao trinkkakao milchkakao', '🍫', 'Milch', 250, 'Glas', r'^Milk, chocolate, fluid, commercial, whole', 'ml'),
 ('Joghurt natur (3,5 %)', 'joghurt natur naturjoghurt yoghurt', '🥛', 'Milch', 150, 'Becher', r'^Yogurt, plain, whole milk'),
 ('Joghurt fettarm', 'joghurt fettarm leicht', '🥛', 'Milch', 150, 'Becher', r'^Yogurt, plain, low fat'),
 ('Fruchtjoghurt', 'fruchtjoghurt früchtejoghurt erdbeerjoghurt', '🍓', 'Milch', 150, 'Becher', r'^Yogurt, fruit, low fat,9 g protein/8 oz'),
 ('Griechischer Joghurt (fettfrei)', 'griechischer joghurt greek', '🥛', 'Milch', 150, 'Becher', r'^Yogurt, Greek, plain, nonfat'),
 ('Skyr natur', 'skyr', '🥛', 'Milch', 150, 'Becher', [63, 11, 4, 4, 0.2, 0.1, 0, 0.1]),
 ('Magertopfen', 'topfen magertopfen quark magerquark', '🥣', 'Milch', 125, 'Portion', [70, 12.5, 4, 4, 0.3, 0.2, 0, 0.1]),
 ('Frischkäse (Doppelrahm)', 'frischkäse philadelphia cream cheese doppelrahm', '🧀', 'Käse', 30, 'Portion', r'^Cheese, cream$'),
 ('Hüttenkäse / Cottage Cheese', 'hüttenkäse cottage cheese', '🧀', 'Käse', 125, 'Becher', r'^Cheese, cottage, lowfat, 2% milkfat$'),
 ('Gouda', 'gouda käse schnittkäse', '🧀', 'Käse', 30, 'Scheibe', r'^Cheese, gouda$'),
 ('Emmentaler', 'emmentaler käse swiss', '🧀', 'Käse', 30, 'Scheibe', r'^Cheese, swiss$'),
 ('Cheddar', 'cheddar', '🧀', 'Käse', 30, 'Scheibe', r'^Cheese, cheddar, sharp, sliced'),
 ('Parmesan', 'parmesan grana reibkäse', '🧀', 'Käse', 10, 'Esslöffel', r'^Cheese, parmesan, hard'),
 ('Mozzarella', 'mozzarella', '🧀', 'Käse', 125, 'Kugel', r'^Cheese, mozzarella, whole milk$'),
 ('Camembert / Brie', 'camembert brie', '🧀', 'Käse', 30, 'Stück', r'^Cheese, camembert'),
 ('Feta / Schafkäse', 'feta schafkäse hirtenkäse', '🧀', 'Käse', 50, 'Stück', r'^Cheese, feta$'),
 ('Ricotta', 'ricotta', '🧀', 'Käse', 50, 'Portion', r'^Cheese, ricotta, whole milk'),
 ('Butter', 'butter teebutter', '🧈', 'Fette', 10, 'Portion', r'^Butter, salted'),
 ('Schlagobers (Sahne)', 'schlagobers sahne obers schlagsahne', '🥛', 'Milch', 30, 'Portion', r'^Cream, fluid, heavy whipping', 'ml'),
 ('Sauerrahm', 'sauerrahm saure sahne', '🥛', 'Milch', 30, 'Portion', r'^Cream, sour, cultured'),
 ('Ei, gekocht', 'ei eier gekocht hartgekocht frühstücksei', '🥚', 'Ei', 60, 'Stück', r'^Egg, whole, cooked, hard-boiled'),
 ('Spiegelei', 'spiegelei spiegeleier ei gebraten', '🍳', 'Ei', 60, 'Stück', r'^Egg, whole, cooked, fried'),
 ('Rührei', 'rührei rühreier', '🍳', 'Ei', 130, '2 Eier', r'^Egg, whole, cooked, scrambled'),
 # --- Fleisch, Wurst, Fisch
 ('Hendlbrust, gebraten', 'hendl hähnchen huhn hühnerbrust hendlbrust pute', '🍗', 'Fleisch', 150, 'Portion', r'^Chicken, broilers or fryers, breast, meat only, cooked, roasted'),
 ('Hendlkeule, gebraten (mit Haut)', 'hendlkeule hühnerkeule keule haxerl hendl', '🍗', 'Fleisch', 150, 'Portion', r'^Chicken, broilers or fryers, drumstick, meat and skin, cooked, roasted'),
 ('Putenbrust, gebraten', 'pute putenbrust truthahn', '🦃', 'Fleisch', 150, 'Portion', r'^Turkey, breast, from whole bird, meat only, with added solution, roasted'),
 ('Schweinsbraten / Schweinslungenbraten', 'schweinsbraten schweinebraten schwein karree lungenbraten', '🍖', 'Fleisch', 150, 'Portion', r'^Pork, fresh, loin, whole, separable lean and fat, cooked, roasted'),
 ('Speck / Bacon (gebraten)', 'speck bacon frühstücksspeck', '🥓', 'Wurst', 20, '2 Scheiben', r'^Pork, cured, bacon, cooked, baked'),
 ('Kochschinken', 'schinken kochschinken beinschinken', '🍖', 'Wurst', 30, 'Scheibe', r'^Ham, sliced, regular \(approximately 11% fat\)'),
 ('Salami', 'salami', '🍕', 'Wurst', 20, '3 Scheiben', r'^Salami, Italian, pork'),
 ('Frankfurter / Würstel', 'frankfurter würstel wurstel wiener', '🌭', 'Wurst', 100, 'Paar', r'^Frankfurter, beef, heated'),
 ('Bratwurst', 'bratwurst', '🌭', 'Wurst', 150, 'Stück', r'^Bratwurst, pork, cooked'),
 ('Leberkäse', 'leberkäse leberkas fleischkäse', '🥪', 'Wurst', 120, 'Scheibe', [290, 12, 2, 1, 26, 10, 0, 2.0]),
 ('Leberwurst / Leberaufstrich', 'leberwurst leberaufstrich pastete', '🥪', 'Wurst', 30, 'Portion', [310, 12, 3, 1, 28, 10, 0, 2.2]),
 ('Faschiertes (Rind/Schwein, roh)', 'faschiertes hackfleisch gemischtes hack rinderhack', '🥩', 'Fleisch', 150, 'Portion', r'^Beef, ground, 85% lean meat / 15% fat, raw'),
 ('Beef Tatar (Rind, roh)', 'beef tartar tatar tartare beef tatar rindertatar tartar', '🥩', 'Fleisch', 150, 'Portion', r'^Beef, ground, 90% lean meat / 10% fat, raw'),
 ('Rindersteak, gebraten', 'rindersteak steak rumpsteak rind rindfleisch rib eye', '🥩', 'Fleisch', 200, 'Steak', r'^Beef, round, top round, separable lean and fat, trimmed to 0" fat, select, cooked'),
 ('Rinderfilet (roh)', 'rinderfilet filet tenderloin', '🥩', 'Fleisch', 200, 'Portion', r'^Beef, tenderloin, steak, separable lean only, trimmed to 1/8" fat, select, raw'),
 ('Kalbfleisch (roh)', 'kalb kalbfleisch kalbsschnitzel', '🥩', 'Fleisch', 150, 'Portion', r'^Veal, loin, separable lean only, raw'),
 ('Entenbrust, gebraten', 'ente entenbrust', '🦆', 'Fleisch', 150, 'Portion', r'^Duck, domesticated, meat only, cooked, roasted'),
 ('Lachs, gebraten', 'lachs lachsfilet salmon', '🐟', 'Fisch', 150, 'Filet', r'^Fish, salmon, Atlantic, farmed, cooked, dry heat'),
 ('Thunfisch (Dose, im Wasser)', 'thunfisch dose tuna', '🐟', 'Fisch', 80, 'abgetropft', r'^Fish, tuna, light, canned in water, drained solids'),
 ('Forelle, gebraten', 'forelle', '🐟', 'Fisch', 150, 'Filet', r'^Fish, trout, rainbow, farmed, cooked, dry heat'),
 ('Kabeljau / Dorsch, gebraten', 'kabeljau dorsch weißfisch fisch', '🐟', 'Fisch', 150, 'Filet', r'^Fish, cod, Atlantic, cooked, dry heat'),
 ('Garnelen, gekocht', 'garnelen shrimps scampi crevetten', '🍤', 'Fisch', 100, 'Portion', r'^Crustaceans, shrimp, cooked'),
 ('Miesmuscheln, gekocht', 'muscheln miesmuscheln', '🦪', 'Fisch', 150, 'Portion', [172, 24, 7.4, 0.5, 4.5, 0.85, 0, 0.9]),
 ('Fischstäbchen', 'fischstäbchen fischstabchen fischstaebchen', '🐟', 'Fisch', 90, '3 Stück', r'^Fish, fish sticks, frozen, prepared'),
 ('Hering (Matjes/eingelegt)', 'hering matjes rollmops', '🐟', 'Fisch', 80, 'Portion', r'^Fish, herring, Atlantic, pickled'),
 ('Tofu', 'tofu sojaquark', '🧈', 'Vegetarisch', 100, 'Portion', r'^Tofu, raw, regular, prepared with calcium sulfate'),
 ('Tempeh', 'tempeh', '🫘', 'Vegetarisch', 100, 'Portion', [192, 20.3, 7.6, 0.5, 10.8, 2.5, 0, 0.02]),
 ('Seitan', 'seitan weizeneiweiß', '🥩', 'Vegetarisch', 100, 'Portion', [120, 25, 4, 0.5, 1.5, 0.2, 1, 1.0]),
 # --- Obst
 ('Banane', 'banane bananen', '🍌', 'Obst', 120, 'Stück', r'^Bananas, raw$'),
 ('Apfel', 'apfel äpfel', '🍎', 'Obst', 180, 'Stück', r'^Apples, raw, with skin'),
 ('Orange / Mandarine', 'orange orangen mandarine clementine', '🍊', 'Obst', 180, 'Stück', r'^Oranges, raw, all commercial varieties'),
 ('Birne', 'birne birnen', '🍐', 'Obst', 180, 'Stück', r'^Pears, raw$'),
 ('Weintrauben', 'weintrauben trauben', '🍇', 'Obst', 150, 'Portion', r'^Grapes, red or green'),
 ('Erdbeeren', 'erdbeeren erdbeere', '🍓', 'Obst', 150, 'Portion', r'^Strawberries, raw'),
 ('Heidelbeeren (Blaubeeren)', 'heidelbeeren blaubeeren', '🫐', 'Obst', 100, 'Portion', r'^Blueberries, raw'),
 ('Himbeeren', 'himbeeren himbeere', '🍓', 'Obst', 100, 'Portion', r'^Raspberries, raw'),
 ('Kiwi', 'kiwi', '🥝', 'Obst', 75, 'Stück', r'^Kiwifruit, green, raw'),
 ('Ananas', 'ananas', '🍍', 'Obst', 150, 'Portion', r'^Pineapple, raw, all varieties'),
 ('Mango', 'mango', '🥭', 'Obst', 150, 'Portion', r'^Mangos, raw'),
 ('Wassermelone', 'wassermelone melone', '🍉', 'Obst', 250, 'Portion', r'^Watermelon, raw'),
 ('Pfirsich / Nektarine', 'pfirsich nektarine', '🍑', 'Obst', 150, 'Stück', r'^Peaches, yellow, raw'),
 ('Kirschen', 'kirschen kirsche', '🍒', 'Obst', 100, 'Portion', r'^Cherries, sweet, raw'),
 ('Marillen (Aprikosen)', 'marille marillen aprikose aprikosen', '🍑', 'Obst', 120, '3 Stück', r'^Apricots, raw'),
 ('Zwetschken (Pflaumen)', 'zwetschke zwetschken pflaume pflaumen', '🟣', 'Obst', 120, '3 Stück', r'^Plums, raw'),
 ('Zitrone', 'zitrone', '🍋', 'Obst', 60, 'Stück', r'^Lemons, raw, without peel'),
 ('Avocado', 'avocado', '🥑', 'Obst', 100, '1/2 Stück', r'^Avocados, raw, all commercial varieties'),
 ('Datteln', 'datteln dattel', '🟤', 'Obst', 40, '2 Stück', r'^Dates, medjool'),
 ('Rosinen', 'rosinen sultaninen', '🍇', 'Obst', 30, 'Handvoll', [299, 3.1, 79, 59, 0.5, 0.2, 3.7, 0.03]),
 # --- Gemüse
 ('Tomate', 'tomate tomaten paradeiser', '🍅', 'Gemüse', 120, 'Stück', r'^Tomatoes, red, ripe, raw, year round average'),
 ('Gurke', 'gurke salatgurke', '🥒', 'Gemüse', 200, 'Stück', r'^Cucumber, with peel, raw'),
 ('Karotte (Möhre)', 'karotte karotten möhre möhren gelbe rübe', '🥕', 'Gemüse', 80, 'Stück', r'^Carrots, raw'),
 ('Paprika', 'paprika', '🫑', 'Gemüse', 150, 'Stück', r'^Peppers, sweet, red, raw'),
 ('Zwiebel', 'zwiebel zwiebeln', '🧅', 'Gemüse', 100, 'Stück', r'^Onions, raw'),
 ('Brokkoli', 'brokkoli broccoli', '🥦', 'Gemüse', 150, 'Portion', r'^Broccoli, raw'),
 ('Karfiol (Blumenkohl)', 'karfiol blumenkohl', '🥦', 'Gemüse', 150, 'Portion', r'^Cauliflower, raw'),
 ('Spinat', 'spinat blattspinat', '🥬', 'Gemüse', 100, 'Portion', r'^Spinach, raw'),
 ('Salat (Kopfsalat/Romana)', 'salat kopfsalat romana blattsalat eisbergsalat', '🥬', 'Gemüse', 80, 'Portion', r'^Lettuce, cos or romaine, raw'),
 ('Champignons', 'champignons pilze schwammerl', '🍄', 'Gemüse', 100, 'Portion', r'^Mushrooms, white, raw'),
 ('Zucchini', 'zucchini', '🥒', 'Gemüse', 200, 'Stück', r'^Squash, summer, zucchini, includes skin, raw'),
 ('Melanzani (Aubergine)', 'melanzani aubergine', '🍆', 'Gemüse', 200, 'Stück', r'^Eggplant, raw'),
 ('Kürbis (Butternut)', 'kürbis butternut hokkaido', '🎃', 'Gemüse', 200, 'Portion', r'^Squash, winter, butternut, raw'),
 ('Mais (Zuckermais)', 'mais zuckermais', '🌽', 'Gemüse', 100, 'Portion', r'^Corn, sweet, yellow, raw'),
 ('Erbsen', 'erbsen grüne erbsen', '🫛', 'Gemüse', 100, 'Portion', r'^Peas, green, raw'),
 ('Grüne Bohnen / Fisolen', 'fisolen grüne bohnen bohnen', '🫛', 'Gemüse', 150, 'Portion', r'^Beans, snap, green, raw'),
 ('Weißkraut', 'kraut weißkraut weisskraut krautsalat', '🥬', 'Gemüse', 150, 'Portion', r'^Cabbage, raw'),
 ('Sauerkraut', 'sauerkraut', '🥬', 'Gemüse', 150, 'Portion', r'^Sauerkraut, canned, solids and liquids'),
 ('Süßkartoffel', 'süßkartoffel sweet potato batate', '🍠', 'Gemüse', 200, 'Stück', r'^Sweet potato, raw, unprepared'),
 # --- Hülsenfrüchte, Nüsse, Samen
 ('Linsen, gekocht', 'linsen', '🫘', 'Hülsenfrüchte', 200, 'Portion', r'^Lentils, mature seeds, cooked, boiled, without salt'),
 ('Kichererbsen, gekocht', 'kichererbsen', '🫘', 'Hülsenfrüchte', 150, 'Portion', r'^Chickpeas \(garbanzo beans, bengal gram\), mature seeds, cooked, boiled, without salt'),
 ('Kidneybohnen, gekocht', 'kidneybohnen bohnen rote bohnen', '🫘', 'Hülsenfrüchte', 150, 'Portion', r'^Beans, kidney, red, mature seeds, cooked, boiled, without salt'),
 ('Schwarze Bohnen, gekocht', 'schwarze bohnen black beans', '🫘', 'Hülsenfrüchte', 150, 'Portion', r'^Beans, black, mature seeds, cooked, boiled, without salt'),
 ('Hummus', 'hummus', '🫘', 'Aufstrich', 50, 'Portion', r'^Hummus, commercial'),
 ('Erdnüsse (geröstet, gesalzen)', 'erdnüsse erdnuss erdnusskerne', '🥜', 'Nüsse', 30, 'Handvoll', [600, 25, 12, 4, 50, 8, 8, 1.2]),
 ('Mandeln', 'mandeln', '🥜', 'Nüsse', 30, 'Handvoll', r'^Nuts, almonds$'),
 ('Walnüsse', 'walnüsse walnuss', '🥜', 'Nüsse', 30, 'Handvoll', r'^Nuts, walnuts, english'),
 ('Cashewkerne', 'cashew cashews cashewkerne', '🥜', 'Nüsse', 30, 'Handvoll', r'^Nuts, cashew nuts, raw'),
 ('Haselnüsse', 'haselnüsse haselnuss', '🌰', 'Nüsse', 30, 'Handvoll', r'^Nuts, hazelnuts or filberts$'),
 ('Pistazien', 'pistazien', '🥜', 'Nüsse', 30, 'Handvoll', r'^Nuts, pistachio nuts, raw'),
 ('Erdnussbutter', 'erdnussbutter erdnussmus peanut butter', '🥜', 'Aufstrich', 20, 'Esslöffel', r'^Peanut butter, smooth style, with salt'),
 ('Sonnenblumenkerne', 'sonnenblumenkerne', '🌻', 'Nüsse', 20, 'Esslöffel', r'^Seeds, sunflower seed kernels, dried'),
 ('Chiasamen', 'chia chiasamen', '🌱', 'Nüsse', 15, 'Esslöffel', [486, 16.5, 42, 0, 30.7, 3.3, 34.4, 0.04]),
 ('Leinsamen', 'leinsamen leinsaat', '🌱', 'Nüsse', 10, 'Esslöffel', r'^Seeds, flaxseed'),
 ('Kokosnuss (Fruchtfleisch)', 'kokos kokosnuss kokosraspeln', '🥥', 'Nüsse', 30, 'Portion', r'^Nuts, coconut meat, raw'),
 # --- Süßes & Snacks (allgemein)
 ('Zucker', 'zucker kristallzucker haushaltszucker', '🍬', 'Süßes', 5, 'Teelöffel', r'^Sugars, granulated'),
 ('Honig', 'honig', '🍯', 'Süßes', 20, 'Esslöffel', r'^Honey$'),
 ('Marmelade', 'marmelade konfitüre', '🍓', 'Süßes', 20, 'Portion', r'^Jams and preserves$'),
 ('Ahornsirup', 'ahornsirup sirup maple', '🍁', 'Süßes', 20, 'Esslöffel', r'^Syrups, maple'),
 ('Nuss-Nougat-Creme (Nutella)', 'nutella nusscreme nougatcreme haselnusscreme', '🍫', 'Süßes', 15, 'Portion', [539, 6.3, 57.5, 56.3, 30.9, 10.6, 0, 0.1]),
 ('Vollmilchschokolade', 'schokolade vollmilchschokolade milchschokolade milka', '🍫', 'Süßes', 25, '3 Stück', r'^Candies, milk chocolate$'),
 ('Zartbitterschokolade (70 %)', 'zartbitterschokolade zartbitter bitterschokolade dunkle schokolade', '🍫', 'Süßes', 20, '2 Stück', r'^Chocolate, dark, 70-85% cacao solids'),
 ('Weiße Schokolade', 'weiße schokolade', '🍫', 'Süßes', 25, '3 Stück', r'^Candies, white chocolate'),
 ('Gummibärchen / Fruchtgummi', 'gummibärchen gummibären fruchtgummi gummi haribo gummibär goldbären', '🐻', 'Süßes', 40, 'Handvoll', [343, 6.9, 77, 46, 0.5, 0.1, 0, 0.1]),
 ('Lakritz', 'lakritz lakritze', '⚫', 'Süßes', 30, 'Handvoll', [350, 3, 82, 40, 1, 0.3, 1.5, 0.9]),
 ('Bonbons (Hartkaramell)', 'bonbon bonbons hartkaramell zuckerl', '🍬', 'Süßes', 5, 'Stück', r'^Candies, hard$'),
 ('Marshmallows / Schaumzucker', 'marshmallow marshmallows schaumzucker mäusespeck', '🍡', 'Süßes', 30, 'Portion', r'^Candies, marshmallows'),
 ('Karamellbonbons / Toffee', 'karamell karamellbonbons toffee', '🍬', 'Süßes', 20, '3 Stück', r'^Candies, caramels$'),
 ('Schokoriegel (Karamell, Erdnuss)', 'schokoriegel riegel snickers erdnussriegel', '🍫', 'Süßes', 50, 'Riegel', r'^Candies, MARS SNACKFOOD US, SNICKERS Bar'),
 ('Waffelriegel (Schoko)', 'waffelriegel kitkat kit kat schokowaffel', '🍫', 'Süßes', 42, 'Riegel', r'^Candies, KIT KAT Wafer Bar'),
 ('Müsliriegel', 'müsliriegel riegel cerealienriegel', '🍫', 'Süßes', 25, 'Riegel', r'^Snacks, granola bars, hard, plain'),
 ('Butterkekse', 'kekse butterkekse butterkeks', '🍪', 'Süßes', 30, '3 Stück', r'^Cookies, butter, commercially prepared, enriched'),
 ('Schokokekse (Cookies)', 'cookies schokokekse schokocookies', '🍪', 'Süßes', 40, '2 Stück', r'^Cookies, chocolate chip, commercially prepared, soft-type'),
 ('Lebkuchen / Ingwerkekse', 'lebkuchen ingwerkekse', '🍪', 'Süßes', 30, 'Stück', r'^Cookies, gingersnaps'),
 ('Kuchen (Rührkuchen / Biskuit)', 'kuchen rührkuchen sandkuchen biskuit', '🍰', 'Süßes', 100, 'Stück', r'^Cake, yellow, commercially prepared, with vanilla frosting'),
 ('Schokokuchen mit Glasur', 'schokokuchen schokotorte', '🍰', 'Süßes', 100, 'Stück', r'^Cake, chocolate, commercially prepared with chocolate frosting'),
 ('Muffin (Heidelbeer)', 'muffin muffins', '🧁', 'Süßes', 100, 'Stück', r'^Muffins, blueberry, commercially prepared'),
 ('Donut (glasiert)', 'donut krapfen doughnut berliner', '🍩', 'Süßes', 70, 'Stück', r'^Doughnuts, yeast-leavened, glazed, enriched'),
 ('Speiseeis (Vanille)', 'eis speiseeis vanilleeis gelato eiscreme', '🍦', 'Süßes', 100, '2 Kugeln', r'^Ice creams, vanilla$'),
 ('Speiseeis (Schoko)', 'schokoeis schokoladeneis', '🍨', 'Süßes', 100, '2 Kugeln', r'^Ice creams, chocolate$'),
 ('Waffel (Tiefkühl)', 'waffel waffeln', '🧇', 'Süßes', 75, '2 Stück', r'^Waffles, plain, frozen, ready-to-heat'),
 ('Pfannkuchen / Palatschinken', 'palatschinken pfannkuchen pancake', '🥞', 'Süßes', 100, 'Stück', [227, 6.4, 28.3, 5, 9.7, 2.1, 1, 1.1]),
 ('Kakaopulver (Instant, gezuckert)', 'kakaopulver kakao instantkakao kaba trinkschokolade', '🍫', 'Süßes', 20, '2 Esslöffel', r'^Beverages, Cocoa mix, powder'),
 ('Kartoffelchips (gesalzen)', 'chips kartoffelchips pringles chio', '🥔', 'Snack', 40, 'Handvoll', r'^Snacks, potato chips, plain, salted'),
 ('Tortilla Chips', 'tortillachips nachos tortilla doritos', '🌽', 'Snack', 40, 'Handvoll', r'^Snacks, tortilla chips, plain, white corn, salted'),
 ('Popcorn (Luft, gesalzen)', 'popcorn', '🍿', 'Snack', 20, 'Schüssel', r'^Snacks, popcorn, air-popped$'),
 ('Salzcracker', 'cracker crackers salzcracker ritz tuc', '🍘', 'Snack', 30, 'Portion', r'^Crackers, standard snack-type, regular$'),
 ('Erdnussflips', 'erdnussflips flips erdnussflips', '🥜', 'Snack', 30, 'Handvoll', [490, 13, 52, 3, 25, 3.5, 4, 1.8]),
 # --- Getränke (je 100 ml)
 ('Cola', 'cola coca cola pepsi', '🥤', 'Getränke', 330, 'Dose', r'^Beverages, carbonated, cola, regular', 'ml'),
 ('Cola Zero / Light', 'cola zero light diet zero', '🥤', 'Getränke', 330, 'Dose', [0.3, 0, 0, 0, 0, 0, 0, 0.02], 'ml'),
 ('Zitronenlimonade (Sprite)', 'sprite limo zitronenlimonade 7up', '🥤', 'Getränke', 330, 'Dose', r'^Beverages, carbonated, lemon-lime soda, no caffeine', 'ml'),
 ('Orangenlimonade (Fanta)', 'fanta orangenlimo orangenlimonade', '🥤', 'Getränke', 330, 'Dose', [48, 0, 12.3, 12, 0, 0, 0, 0.03], 'ml'),
 ('Tonic Water', 'tonic tonic water', '🥤', 'Getränke', 200, 'Glas', r'^Beverages, carbonated, tonic water', 'ml'),
 ('Eistee (gezuckert)', 'eistee ice tea lipton nestea', '🧋', 'Getränke', 330, 'Dose', [30, 0, 7.5, 7.2, 0, 0, 0, 0.01], 'ml'),
 ('Apfelsaft', 'apfelsaft saft', '🧃', 'Getränke', 250, 'Glas', r'^Apple juice, canned or bottled, unsweetened, without added ascorbic', 'ml'),
 ('Orangensaft', 'orangensaft saft', '🧃', 'Getränke', 250, 'Glas', r'^Orange juice, raw', 'ml'),
 ('Apfelsaft gespritzt', 'gespritzter apfelsaft gespritzt apfelspritzer', '🧃', 'Getränke', 500, 'Glas', [23, 0.05, 5.6, 4.8, 0.07, 0, 0.1, 0.005], 'ml'),
 ('Energy Drink', 'energy drink red bull monster', '🥫', 'Getränke', 250, 'Dose', r'^Beverages, Energy drink, ROCKSTAR', 'ml'),
 ('Sojadrink', 'sojadrink sojamilch', '🥛', 'Getränke', 250, 'Glas', r'^Soymilk \(All flavors\), enhanced', 'ml'),
 ('Mandeldrink (ungesüßt)', 'mandeldrink mandelmilch', '🥛', 'Getränke', 250, 'Glas', r'^Beverages, almond milk, unsweetened, shelf stable', 'ml'),
 ('Haferdrink', 'haferdrink hafermilch oatly', '🥛', 'Getränke', 250, 'Glas', [46, 1, 6.7, 4, 1.5, 0.2, 0.8, 0.1], 'ml'),
 ('Kaffee schwarz', 'kaffee espresso schwarzer', '☕', 'Getränke', 200, 'Tasse', r'^Beverages, coffee, brewed, prepared with tap water', 'ml'),
 ('Cappuccino', 'cappuccino melange kaffee mit milch', '☕', 'Getränke', 200, 'Tasse', [40, 2.1, 3.3, 3.3, 2, 1.3, 0, 0.05], 'ml'),
 ('Latte Macchiato', 'latte macchiato milchkaffee', '☕', 'Getränke', 300, 'Glas', [48, 2.5, 3.8, 3.8, 2.5, 1.6, 0, 0.05], 'ml'),
 ('Tee (ungesüßt)', 'tee schwarztee grüntee früchtetee', '🍵', 'Getränke', 250, 'Tasse', r'^Beverages, tea, black, brewed, prepared with tap water', 'ml'),
 ('Bier (Lager/Hell)', 'bier helles lager krügerl seidel', '🍺', 'Alkohol', 500, 'Krügerl', r'^Alcoholic beverage, beer, regular, all', 'ml'),
 ('Radler (Bier + Zitronenlimo)', 'radler shandy', '🍺', 'Alkohol', 500, 'Flasche', [34, 0.2, 6.5, 6, 0, 0, 0, 0.01], 'ml'),
 ('Wein (Rot/Weiß)', 'wein rotwein weißwein achterl gspritzter', '🍷', 'Alkohol', 125, 'Achterl', r'^Alcoholic beverage, wine, table, all', 'ml'),
 ('Sekt / Prosecco', 'sekt prosecco champagner', '🥂', 'Alkohol', 125, 'Glas', [75, 0.2, 3, 2.5, 0, 0, 0, 0.01], 'ml'),
 ('Wodka / Schnaps (40 %)', 'wodka schnaps vodka', '🥃', 'Alkohol', 20, '2 cl', r'^Alcoholic beverage, distilled, vodka, 80 proof', 'ml'),
 ('Proteinshake (Pulver + Wasser)', 'proteinshake eiweißshake whey shake', '🥤', 'Getränke', 300, 'Shaker', [40, 8, 1.2, 0.8, 0.5, 0.3, 0.2, 0.15], 'ml'),
 ('Mineralwasser', 'wasser mineralwasser leitungswasser', '💧', 'Getränke', 250, 'Glas', [0, 0, 0, 0, 0, 0, 0, 0.005], 'ml'),
 # --- Öle, Soßen, Aufstriche
 ('Olivenöl', 'olivenöl öl', '🫒', 'Fette', 10, 'Esslöffel', r'^Oil, olive, salad or cooking'),
 ('Sonnenblumenöl / Rapsöl', 'sonnenblumenöl rapsöl pflanzenöl öl', '🌻', 'Fette', 10, 'Esslöffel', r'^Oil, sunflower, linoleic, \(approx. 65%\)'),
 ('Mayonnaise', 'mayo mayonnaise', '🥚', 'Soßen', 15, 'Esslöffel', [680, 1.1, 1.5, 1.2, 75, 6, 0, 1.6]),
 ('Ketchup', 'ketchup catsup', '🍅', 'Soßen', 15, 'Esslöffel', r'^Catsup$'),
 ('Senf', 'senf mostrich', '🟡', 'Soßen', 10, 'Teelöffel', r'^Mustard, prepared, yellow'),
 ('Sojasauce', 'sojasauce sojasoße soja soy', '🥢', 'Soßen', 15, 'Esslöffel', r'^Soy sauce made from soy and wheat \(shoyu\)'),
 ('Tomatensauce (Nudelsauce)', 'tomatensauce nudelsauce pastasauce marinara', '🍅', 'Soßen', 125, 'Portion', r'^Sauce, pasta, spaghetti/marinara, ready-to-serve$'),
 ('Pesto', 'pesto basilikumpesto pesto genovese', '🌿', 'Soßen', 30, 'Portion', [470, 5, 4, 2, 47, 8, 2, 2.5]),
 ('Salatdressing (Essig-Öl)', 'dressing salatsauce essig öl vinaigrette', '🥗', 'Soßen', 30, 'Portion', [240, 0.3, 4, 3, 24, 3.5, 0, 1.5]),
 ('Fertig-Pizza (Käse, TK)', 'pizza tiefkühlpizza tk pizza margherita', '🍕', 'Fertiggericht', 350, 'Pizza', r'^Pizza, cheese topping, regular crust, frozen, cooked'),
 ('Fertig-Pizza (Salami/Gemüse, TK)', 'pizza salami schinken tiefkühl', '🍕', 'Fertiggericht', 380, 'Pizza', r'^Pizza, meat and vegetable topping, regular crust, frozen, cooked'),
 ('Frühlingsrolle', 'frühlingsrolle frühlingsrollen eggroll spring roll', '🥟', 'Fertiggericht', 80, 'Stück', r'^Egg rolls, vegetable, frozen, prepared'),
]

def build():
    out, bad = [], []
    for row in G:
        name, aliases, emoji, cat, portion, unit, src = row[:7]
        ml = len(row) > 7 and row[7] == 'ml'
        if isinstance(src, list):
            n = list(src)
            if len(n) != 8: bad.append((name, 'manual len')); continue
            note = 'Richtwert'
        else:
            res = usda.find(src, 3)
            if not res: bad.append((name, 'no match ' + src)); continue
            i, d = res[0]
            sugar = d['sugar']
            if sugar is None: sugar = 0 if d['kh'] < 5 else None
            if sugar is None: bad.append((name, 'sugar missing ' + d['desc'])); continue
            sat = d['sat'] if d['sat'] is not None else 0
            fiber = d['fiber'] if d['fiber'] is not None else 0
            na = d['na'] if d['na'] is not None else 0
            n = [d['kcal'], d['prot'], d['kh'], sugar, d['fat'], sat, fiber, round(na * 2.5 / 1000, 2)]
            note = 'USDA ' + i
        out.append(dict(name=name, al=aliases, e=emoji, cat=cat, g=portion, u=unit, ml=ml, n=[round(x, 2) if isinstance(x, float) else x for x in n], src=note))
    return out, bad

if __name__ == '__main__':
    out, bad = build()
    print(len(out), 'items; problems:', bad)
    if '--show' in sys.argv:
        for o in out: print(o['name'][:38].ljust(38), o['src'].ljust(12), o['n'])
    if '--write' in sys.argv:
        js = '/* Automatisch erzeugt (scripts): Grundnahrungsmittel – Werte je 100 g bzw. 100 ml [kcal, Eiweiß, KH, Zucker, Fett, ges. Fett, Ballaststoffe, Salz]. Quelle: USDA FoodData Central (SR Legacy, gemeinfrei), teils Richtwerte. */\n'
        js += 'export const GENERIC = ' + json.dumps([[o['name'], o['al'], o['e'], o['cat'], o['g'], o['u'], 1 if o['ml'] else 0, o['n'], 'u' if o['src'].startswith('USDA') else 'r'] for o in out], ensure_ascii=False, separators=(',', ':')) + ';\n'
        open(os.path.join(REPO, 'src', 'generic.js'), 'w').write(js)
        print('written', len(js), 'bytes')
